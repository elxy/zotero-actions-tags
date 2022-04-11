export default {
  defaultRules: [
    {
      id: 1,
      tags: ["/unread"],
      autoadd: true,
      autoremove: true,
      color: "red",
      group: 1,
    },
  ],
  rules: function () {
    // Set default if not set.
    if (Zotero.Prefs.get("zoterotag.rules") === undefined) {
      Zotero.Prefs.set(
        "zoterotag.rules",
        JSON.stringify(Zotero.ZoteroTag.defaultRules)
      );
    }
    return JSON.parse(Zotero.Prefs.get("zoterotag.rules"));
  },
  resetRules: function (newRules = undefined) {
    if (typeof newRules === "undefined") {
      newRules = Zotero.ZoteroTag.defaultRules;
    }
    Zotero.Prefs.set("zoterotag.rules", JSON.stringify(newRules));
    return JSON.parse(Zotero.Prefs.get("zoterotag.rules"));
  },
  addRule: function (rule) {
    let rules = Zotero.ZoteroTag.rules();
    rule.id = rules.length + 1;
    rules.push(rule);
    Zotero.Prefs.set("zoterotag.rules", JSON.stringify(rules));
    return JSON.parse(Zotero.Prefs.get("zoterotag.rules"));
  },
  replaceRule: function (rule, id) {
    let rules = Zotero.ZoteroTag.rules();
    if (id > rules.length || id <= 0) {
      Zotero.debug("Zotero Tag Error: replaceRule out of range.");
    } else {
      rules[id - 1] = rule;
      Zotero.Prefs.set("zoterotag.rules", JSON.stringify(rules));
    }
    return JSON.parse(Zotero.Prefs.get("zoterotag.rules"));
  },
  removeRule: function (id) {
    let rules = Zotero.ZoteroTag.rules();
    if (id > rules.length || id <= 0) {
      Zotero.debug("Zotero Tag Error: removeRule out of range.");
    } else {
      rules.splice(id - 1, 1);
      for (let i = id - 1; i < rules.length; i++) {
        rules[i].id = i + 1;
      }
      Zotero.Prefs.set("zoterotag.rules", JSON.stringify(rules));
    }
    return JSON.parse(Zotero.Prefs.get("zoterotag.rules"));
  },
};