import { KeyModifier } from "zotero-plugin-toolkit";
import { ActionEventTypes, ActionArgs, applyAction } from "../utils/actions";
import { isLibraryAutomationDisabled } from "../utils/libraries";

export {
  dispatchActionByEvent,
  dispatchActionByShortcut,
  dispatchActionByKey,
  recordPendingAction,
  executePendingActions,
};

async function dispatchActionByEvent(
  eventType: ActionEventTypes,
  data: Omit<ActionArgs, "triggerType">,
) {
  // Event-triggered automation can be disabled per-library in the prefs pane.
  // Events without a target item (startup, window load/unload) always run.
  const item =
    (Zotero.Items.get(data.itemID || -1) as Zotero.Item | false) || null;
  if (item && isLibraryAutomationDisabled(item.libraryID)) {
    return;
  }
  const actions = getActionsByEvent(eventType);
  for (const action of actions) {
    await applyAction(
      action,
      Object.assign({}, data, {
        triggerType: eventType,
      }),
    );
  }
}

function getActionsByEvent(event: ActionEventTypes) {
  return Array.from(addon.data.actions.map.values()).filter(
    (action) => action.event === event && action.enabled,
  );
}

async function dispatchActionByShortcut(
  shortcut: KeyModifier,
  data: Omit<ActionArgs, "triggerType">,
) {
  const actions = getActionsByShortcuts(shortcut);
  for (const action of actions) {
    await applyAction(
      action,
      Object.assign({}, data, {
        triggerType: "shortcut",
      } as ActionArgs),
    );
  }
}

function getActionsByShortcuts(shortcut: KeyModifier) {
  return Array.from(addon.data.actions.map.values()).filter(
    (action) =>
      action.enabled &&
      action.shortcut &&
      new KeyModifier(action.shortcut).equals(shortcut),
  );
}

async function dispatchActionByKey(key: string, data: ActionArgs) {
  const action = addon.data.actions.map.get(key);
  if (!action) {
    return;
  }
  await applyAction(action, data);
}

/**
 * 记录待执行的动作到队列，而不是立即执行。
 * 用于解决 Connector 保存 session 的竞态问题：
 * add 事件时记录，等 modify 事件（或 5 秒超时）后再执行。
 */
function recordPendingAction(
  itemID: number,
  triggerType: ActionEventTypes,
) {
  const queue = addon.data.pendingTags.queue;
  const existingRecord = queue.get(itemID);

  if (existingRecord) {
    // 已有记录，追加新的 triggerType（如果不重复）
    const key = String(triggerType);
    if (!existingRecord.actionKeys.includes(key)) {
      existingRecord.actionKeys.push(key);
    }
    return;
  }

  // 首次记录：设置 5 秒超时兜底
  const timeoutHandle = setTimeout(() => {
    ztoolkit.log(
      `[pendingTags] Timeout: executing pending actions for item ${itemID}`,
    );
    executePendingActions(itemID);
  }, 5000);

  queue.set(itemID, {
    actionKeys: [String(triggerType)],
    recordedAt: Date.now(),
    timeoutHandle,
  });

  ztoolkit.log(
    `[pendingTags] Recorded pending action for item ${itemID}, triggerType=${triggerType}`,
  );
}

/**
 * 执行待处理的动作并从队列中移除。
 * 由 modify 事件触发，或超时后自动触发。
 */
async function executePendingActions(itemID: number) {
  const queue = addon.data.pendingTags.queue;
  const record = queue.get(itemID);
  if (!record) return;

  // 先从队列移除，防止重复执行
  queue.delete(itemID);

  // 清除超时
  if (record.timeoutHandle) {
    clearTimeout(record.timeoutHandle);
  }

  // 获取条目最新状态
  const item = Zotero.Items.get(itemID);
  if (!item) {
    ztoolkit.log(
      `[pendingTags] Item ${itemID} no longer exists, skipping`,
    );
    return;
  }

  // 对每个待执行的 triggerType，查找匹配的动作并执行
  for (const actionKey of record.actionKeys) {
    const triggerType = parseInt(actionKey) as ActionEventTypes;
    const matchingActions = getActionsByEvent(triggerType);

    for (const action of matchingActions) {
      await applyAction(action, {
        itemID,
        triggerType,
      });
    }
  }

  ztoolkit.log(
    `[pendingTags] Executed pending actions for item ${itemID}`,
  );
}
