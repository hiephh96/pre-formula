import {DIMENSIONS, METRICS, OPERATOR} from "@/shared/constants";
import {convertOtherToText, convertTextToOther} from "@/shared/helpers";
import {schema} from "@/shared/schema";
import {Plugin, TextSelection} from "prosemirror-state";

// Utility function to convert the document content to plain text
export const convertDocToPlainText = (doc) => {
  let textContent = "";

  doc?.descendants((node, pos, parent) => {
    if (node.isText) {
      if (!["metric", "dimension"].includes(parent?.type?.name)) {
        textContent += node.text;
      }
    } else if (node.type.name === "metric") {
      textContent += node.attrs.metricId;
    } else if (node.type.name === "dimension") {
      textContent += node.attrs.dimensionId;
    } else if (node.type.name === "operator") {
      textContent += node.attrs.operator;
    }
  });

  return textContent;
};

// Handling copy event
const handleCopy = (view, event) => {
  const { state } = view;
  const { doc, selection } = state;
  const { from, to } = selection;
  const slice = doc.slice(from, to);
  const textContent = convertDocToPlainText(slice.content);
  console.log(slice, from, to);
  event.clipboardData.setData("text/plain", textContent);
  console.log('handleCopy', textContent);

  event.preventDefault();
};

// Utility function to parse plain text into ProseMirror nodes
const convertTextToNodes = (text, schema) => {
  const fragments = [];
  const tokens = text.split(/(\s+)/).filter(token => token.trim().length > 0);

  console.log({tokens});
  tokens.forEach(token => {
    const metric = METRICS.find(m => m.id === token);
    const dimension = DIMENSIONS.find(d => d.id === token);
    const operator = OPERATOR.find(o => o.value.toLowerCase() === token.toLowerCase());

    if (metric) {
      fragments.push(schema.nodes.metric.create({ metricId: metric.id }, schema.text(metric.name)));
    } else if (dimension) {
      fragments.push(schema.nodes.dimension.create({ dimensionId: dimension.id }, schema.text(dimension.name)));
    } else if (operator) {
      fragments.push(schema.nodes.operator.create({ operator: operator.value }));
    } else {
      fragments.push(schema.text(token));
    }
  });

  return fragments;
};

// Handling paste event
const handlePaste = (view, event) => {
  const { state, dispatch } = view;
  const { schema, selection } = state;
  const { from, to, anchor} = selection;
  const text = event.clipboardData.getData("text/plain");

  let transactionData = {
    transaction: view.state.tr,
    cursor: anchor,
    rePosition: 0,
  };

  transactionData = convertTextToOther(schema.text(text), transactionData, from);
  dispatch(transactionData.transaction);

  view.focus();
  event.preventDefault();
};

export const CopyPastePlugin = new Plugin({
  props: {
    handleDOMEvents: {
      copy: (view, event) => handleCopy(view, event),
      paste: (view, event) => handlePaste(view, event),
    },
  },
})
