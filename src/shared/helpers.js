import {DIMENSIONS, METRICS, OPERATOR} from "@/shared/constants";
import {schema} from "@/shared/schema";
import {LogSpanAllowList} from "next/dist/server/lib/trace/constants";

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function splitStringByKeywords(input, keywords) {
  if (!input || !keywords?.length) return {};

  const escapedKeywords = keywords.map(keyword => escapeRegExp(keyword));

  const pattern = new RegExp(`(${escapedKeywords.join("|")})`, "gi");

  // Split the input string by the pattern
  const parts = input.split(pattern);
  console.log({parts});
  // Filter out empty strings and check if any keyword was matched
  const result = parts.filter(part => part !== "");

  const matchedKeywords = result.find(part => keywords.includes(part.toLowerCase()));

  // If no keyword was matched, return null
  if (!matchedKeywords) {
    return {};
  }

  // Return the result
  return {
    matchedKeywords,
    splitContents: result,
  };
}

export const convertEditorStateToText = (view) => {
  const doc = view?.state?.doc;
  if (!doc) return "";

  let textContent = "";

  doc.descendants((node, pos, parent) => {
    if (node.isText) {
      if (!["metric", "dimension"].includes(parent?.type?.name)) {
        textContent += node.text;
      }
    } else if (node.type.name === "metric") {
      textContent += node.attrs.metricId + "|";
    } else if (node.type.name === "dimension") {
      textContent += node.attrs.dimensionId + "|";
    } else if (node.type.name === "operator") {
      textContent += node.attrs.operator + "|";
    }
  });

  return textContent;
};
// Object.values(OPERATOR), operator
export const convertTextToOther = (params, target) => {
  const {node, view, pos} = params;
  const {keywords, type, attrKey} = target;

  console.log(`--convert Text To [${type}]`, params);

  const from = pos;
  const nodeType = node?.type?.name;
  const {matchedKeywords, splitContents} = splitStringByKeywords(node?.textContent, keywords);
  const tr = view?.state?.tr;

  if (nodeType !== "text" || !matchedKeywords || !tr || !schema.nodes[type]) {
    console.warn(`Fail`);
    return false;
  }

  console.log(`Oke`);

  let start = from;
  splitContents.forEach((text) => {
    let end = start + text.length;
    console.log(start, end);
    const textNode = schema.text(text);

    if (text === matchedKeywords) {
      const operatorNode = schema.nodes[type].create({[attrKey]: matchedKeywords});
      tr.replaceRangeWith(start, end, operatorNode);
    } else {
      tr.replaceRangeWith(start, end, textNode);
    }

    start = end + 1;
  });

  // const newPos = from + operatorNode.nodeSize;
  // tr.setSelection(EditorState.create(view.state).selection.constructor.near(tr.doc.resolve(newPos)));
  return tr.docChanged;
};

export const convertTextToOperator = (params) => {
  return convertTextToOther(
    params,
    {
      type: "operator",
      keywords: Object.values(OPERATOR),
      attrKey: "operator",
    });
};

export const convertTextToMetric = (params) => {
  return convertTextToOther(
    params,
    {
      type: "metric",
      keywords: Object.values(METRICS),
      attrKey: "metricId",
    },
  );
};

export const convertTextToDimension = (params) => {
  return convertTextToOther(
    params,
    {
      type: "dimension",
      keywords: Object.values(DIMENSIONS),
      attrKey: "dimensionId",
    },
  );
};

export const convertOtherToText = (params, source) => {
  const {node, view, pos} = params;
  const {keywords, type} = source;

  console.log(`--convert [${type}] to Text`, params);

  const from = pos;
  const nodeType = node?.type?.name;
  const {matchedKeywords, splitContents} = splitStringByKeywords(node?.textContent, keywords);
  const tr = view?.state?.tr;
  const content = node?.textContent;

  if (nodeType === "text" || content === matchedKeywords || type !== nodeType) {
    console.warn(`convert [${type}] to Text Fail`);
    return false;
  }

  console.log(`convert [${type}] to Text`, params, {matchedKeywords, splitContents});

  if (splitContents?.length) {
    let start = from;
    splitContents.forEach((text) => {
      let end = start + text.length;
      const textNode = schema.text(text);

      if (text === matchedKeywords) {
        const operatorNode = schema.nodes[nodeType].create(node.attrs, textNode);
        tr.replaceRangeWith(start, end, operatorNode);
      } else {
        tr.replaceRangeWith(start, end, textNode);
      }

      start = end + 1;
    });
  } else {
    const textNode = schema.text(content);
    tr.replaceRangeWith(from, textNode.nodeSize, textNode);
  }

  return tr.docChanged;
};

export const convertOperatorToText = (params) => {
  return convertOtherToText(
    params,
    {
      type: "operator",
      keywords: Object.values(OPERATOR),
    });
};

export const convertMetricToText = (params) => {
  return convertOtherToText(
    params,
    {
      type: "metric",
      keywords: Object.values(METRICS),
    },
  );
};

export const convertDimensionToText = (params) => {
  return convertOtherToText(
    params,
    {
      type: "dimension",
      keywords: Object.values(DIMENSIONS),
    },
  );
};
