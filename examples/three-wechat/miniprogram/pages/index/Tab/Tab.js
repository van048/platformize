Component({
  properties: {
    tabs: {
      type: Array,
      value: [],
    },
    activeTabId: {
      type: null,
      value: null,
    },
    customClass: {
      type: String,
      value: "",
    },
    disable: {
      type: Boolean,
      value: false,
    },
  },
  data: {
    activeTab: null,
  },
  observers: {
    activeTabId: function (newVal) {
      this.setData({ activeTab: newVal });
    },
    activeTab: function (newVal) {
      this.updateTabHeaderStyle();
    },
  },
  methods: {
    clickTab(e) {
      if (this.data.disable) return;
      const index = e.currentTarget.dataset.index;
      const tab = this.data.tabs[index];
      this.setData({ activeTab: tab.id });
      this.triggerEvent("tabClicked", { tabId: this.data.activeTab });
    },
    updateTabHeaderStyle() {
      const index = this.data.tabs.findIndex(
        (it) => it.id === this.data.activeTab
      );
      this.setData({
        tabHeaderBgStyle: `transform: translateX(${100 * index}%)`,
      });
    },
  },
  ready: function () {
    this.setData({ activeTab: this.data.activeTabId });
    this.updateTabHeaderStyle();
  },
});
