import {DIMENSIONS, METRICS, OPERATOR} from "@/shared/constants";
import {schema} from "@/shared/schema";

const convertTextToKeyword = (input, metrics, dimensions, BinaryOperator) => {
  // Convert metrics and dimensions to Map for efficient lookups
  const metricMap = new Map(metrics.map(({id, name}) => [name, id]));
  const dimensionMap = new Map(dimensions.map(({id, name}) => [name, id]));

  // Convert BinaryOperator values to a Set for efficient lookups
  const binaryOperatorSet = new Set(BinaryOperator.map(op => op.value));

  const result = [];
  let remainingText = input;

  const findMatch = (text, values) => {
    for (const value of values.keys()) {
      if (text.startsWith(value)) {
        return value;
      }
    }
    return null;
  };

  while (remainingText.length > 0) {
    let match = findMatch(remainingText, binaryOperatorSet);
    if (match) {
      result.push({type: "binary_operator", value: match});
      remainingText = remainingText.slice(match.length);
      continue;
    }

    match = findMatch(remainingText, metricMap);
    if (match) {
      const metricId = metricMap.get(match);
      result.push({type: "metric", value: match, metricId});
      remainingText = remainingText.slice(match.length);
      continue;
    }

    match = findMatch(remainingText, dimensionMap);
    if (match) {
      const dimensionId = dimensionMap.get(match);
      result.push({type: "dimension", value: match, dimensionId});
      remainingText = remainingText.slice(match.length);
      continue;
    }

    let nextSpecialCharIndex = Math.min(
      ...[...binaryOperatorSet, ...metricMap.keys(), ...dimensionMap.keys()].map(op => remainingText.indexOf(op)).filter(index => index > -1),
    );

    if (nextSpecialCharIndex === Infinity) {
      nextSpecialCharIndex = remainingText.length;
    }

    const textPart = remainingText.slice(0, nextSpecialCharIndex);
    result.push({type: "text", value: textPart});
    remainingText = remainingText.slice(textPart.length);
  }

  return result;
};

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

export const convertTextToOther = (node, transaction, pos) => {
  const splitContents = convertTextToKeyword(node?.textContent, METRICS, DIMENSIONS, OPERATOR);
  console.log("convertTextToOther: ", splitContents);

  if (!splitContents.length) {
    return transaction;
  }

  let start = pos;
  transaction.deleteRange(start, start + node.nodeSize);
  splitContents.forEach((part) => {
    const {type, value} = part;
    console.log(`--convert "${value}" To [${type}]`);
    const textNode = schema.text(value);
    switch (type) {
      case "text":
      {
        console.log('textNode', textNode);
        transaction.insert(start, textNode)
        break;
      }
      case "metric":
      {
        const metricNode = schema.nodes.metric.create({metricId: part.metricId}, textNode);
        console.log('metric', metricNode);

        transaction.insert(start, metricNode);
        break;
      }
      case "dimension":
      {
        const dimensionNode = schema.nodes.dimension.create({dimensionId: part.dimensionId}, textNode);
        transaction.insert(start, dimensionNode);
        break;
      }
      case "binary_operator":
      {
        const operatorNode = schema.nodes.operator.create({operator: value});
        transaction.insert(start, operatorNode);
        break;
      }
      default:
        break;
    }
    console.log(`--replaceRangeWith: ${start} - ${start + textNode.nodeSize}`);
    start = start + textNode.nodeSize + 1;
  });
  return transaction;
};

export const convertOtherToText = (node, transaction, pos) => {
  const nodeType = node?.type?.name;
  if (nodeType === "text") {
    console.warn("convertOtherToText: node is text");
    return transaction;
  }
  const content = node?.textContent;
  console.log(`--convert [${nodeType}] To Text: "${content}"`, pos);

  switch (nodeType) {
    case "dimension":
    {
      const dimensionId = node?.attrs?.dimensionId;
      const dimension = DIMENSIONS.find(dim => dim.id === dimensionId && dim.name === content);
      if (!dimension) {
        return convertTextToOther(node, transaction, pos);
      }
      break;
    }
    case "metric":
    {
      const metricId = node?.attrs?.metricId;
      const metric = METRICS.find(metric => metric.id === metricId && metric.name === content);
      if (!metric) {
        return convertTextToOther(node, transaction, pos);
      }
      break;
    }
    case "operator":
    {
      const operator = node?.attrs?.operator;
      if (!OPERATOR.find(op => op.value === operator)) {
        return convertTextToOther(node, transaction, pos);
      }
      break;
    }
    default:
      return transaction;
  }

  return transaction;
};
