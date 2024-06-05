import {Schema} from "prosemirror-model";

export const nodes = {
  doc: {
    content: "block+",
  },
  paragraph: {
    content: "inline*",
    group: "block",
    parseDOM: [{tag: "p"}],
    toDOM: () => ["p", 0],
  },
  text: {
    group: "inline",
    inline: true,
  },
  metric: {
    content: "text*",
    group: "inline",
    inline: true,
    atom: false,
    attrs: {
      metricId: {default: ""},
    },
    toDOM: (node) => ["span", {
      "data-metric-id": node.attrs.metricId,
      "class": "metric",
    }, 0],
    parseDOM: [{
      tag: "span[data-metric-id]",
      getAttrs: dom => ({
        metricId: dom.getAttribute("data-metric-id"),
      }),
    }],
  },
  dimension: {
    content: "text*",
    group: "inline",
    inline: true,
    atom: false,
    attrs: {
      dimensionId: {default: ""},
    },
    toDOM: (node) => ["span", {
      "data-dimension-id": node.attrs.dimensionId,
      "class": "dimension",
    }, 0],
    parseDOM: [{
      tag: "span[data-dimension-id]",
      getAttrs: dom => ({
        dimensionId: dom.getAttribute("data-dimension-id"),
      }),
    }],
  },
  aggregation: {
    content: "text*",
    group: "inline",
    inline: true,
    atom: false,
    attrs: {
      aggregation: {default: ""},
    },
    toDOM: (node) => ["span", {
      "data-aggregation": node.aggregation,
      "class": "aggregation",
    }, 0],
    parseDOM: [{
      tag: "span[data-aggregation]",
      getAttrs: dom => ({
        dimensionId: dom.getAttribute("data-aggregation"),
      }),
    }],
  },
  // bracket: {
  //   content: "text*",
  //   group: 'inline',
  //   inline: true,
  //   atom: true,
  //   attrs: {
  //     operator: { default: '' },
  //   },
  //   toDOM: (node) => ['span', {
  //     'data-operator': node.attrs.operator,
  //     class: 'operator' }, node.attrs.operator],
  //   parseDOM: [{
  //     tag: 'span[data-operator]',
  //     getAttrs: dom => ({ operator: dom.getAttribute('data-operator') }),
  //   }],
  // },
  operator: {
    content: "text*",
    group: 'inline',
    inline: true,
    atom: true,
    attrs: {
      operator: { default: '' },
    },
    toDOM: (node) => ['span', {
      'data-operator': node.attrs.operator,
      class: 'operator' }, node.attrs.operator],
    parseDOM: [{
      tag: 'span[data-operator]',
      getAttrs: dom => ({ operator: dom.getAttribute('data-operator') }),
    }],
  },
};

export const schema = new Schema({nodes});
