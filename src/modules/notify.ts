import { ActionEventTypes } from "../utils/actions";
import { recordPendingAction, executePendingActions } from "./dispatch";
import { recordTabStatus } from "./tabs";

export { initNotifierObserver };

function initNotifierObserver() {
  const callback = {
    notify: async (
      event: string,
      type: string,
      ids: number[] | string[],
      extraData: { [key: string]: any },
    ) => {
      if (!addon?.data.alive) {
        Zotero.Notifier.unregisterObserver(notifierID);
        return;
      }
      onNotify(event, type, ids, extraData);
    },
  };

  // Register the callback in Zotero as an item observer
  const notifierID = Zotero.Notifier.registerObserver(callback, [
    "tab",
    "item",
    "file",
  ]);
}

async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  ztoolkit.log("notify", event, type, ids, extraData);
  if (extraData?.skipAutoSync) return;
  if (event === "open" && type === "file") {
    const parentItems = Zotero.Items.getTopLevel(
      Zotero.Items.get(ids as number[]),
    );
    for (const item of parentItems) {
      await addon.api.actionManager.dispatchActionByEvent(
        ActionEventTypes.openFile,
        {
          itemID: item.id,
        },
      );
    }
    return;
  }
  if (event === "add" && type === "item") {
    const items = Zotero.Items.get(ids as number[]).filter(
      (item) => !(item instanceof Zotero.FeedItem),
    );
    for (const item of items) {
      if (item.isRegularItem()) {
        // 记录到队列，等 modify 事件或超时后再执行
        // 解决 Connector 保存 session 覆盖标签的竞态问题
        recordPendingAction(item.id, ActionEventTypes.createItem);
      } else if (item.isAnnotation()) {
        recordPendingAction(item.id, ActionEventTypes.createAnnotation);
        const parentItem = Zotero.Items.getTopLevel([item])[0];
        recordPendingAction(parentItem.id, ActionEventTypes.appendAnnotation);
      } else if (item.isNote()) {
        recordPendingAction(item.id, ActionEventTypes.createNote);
        const parentItem = Zotero.Items.getTopLevel([item])[0];
        recordPendingAction(parentItem.id, ActionEventTypes.appendNote);
      }
    }
    return;
  }
  if (event === "modify" && type === "item") {
    // 检查是否有待处理的标签操作
    for (const itemID of ids as number[]) {
      if (addon.data.pendingTags.queue.has(itemID)) {
        await executePendingActions(itemID);
      }
    }
    return;
  }
  if (event === "modify" && type === "item") {
    const items = Zotero.Items.get(ids as number[]).filter((item) =>
      item.isAnnotation(),
    );
    for (const item of items) {
      const changed = extraData?.[item.id]?.changed;
      if (changed?.annotationColor !== undefined) {
        await addon.api.actionManager.dispatchActionByEvent(
          ActionEventTypes.changeAnnotationColor,
          {
            itemID: item.id,
          },
        );
      }
    }
    return;
  }
  if (event === "add" && type === "tab") {
    recordTabStatus();
    return;
  }
  if (event == "close" && type == "tab") {
    const itemIDs = ids
      .map((id) => addon.data.tabStatus.get(id as string))
      .filter((id) => id);
    const parentItems = Zotero.Items.getTopLevel(
      Zotero.Items.get(itemIDs as number[]),
    );
    for (const item of parentItems) {
      await addon.api.actionManager.dispatchActionByEvent(
        ActionEventTypes.closeTab,
        {
          itemID: item.id,
        },
      );
    }
  } else {
    return;
  }
}
