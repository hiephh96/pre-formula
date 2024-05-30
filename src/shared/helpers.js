import {
  AGGREGATION,
  DIMENSIONS,
  METRICS,
  OPERATOR,
} from "@/shared/constants";
import {schema} from "@/shared/schema";
import {LogSpanAllowList} from "next/dist/server/lib/trace/constants";

const convertTextToToken = (input) => {
  const result = [];
  let remainingText = input;

  const findMatch = (text, data) => {
    for (const item of data) {
      if (typeof item === "object") {
        const {id, name, value} = item;
        if (text.startsWith(id)) {
          return {value: name, id, type: "id", matchLength: id.length};
        }
        if (text.startsWith(name)) {
          return {value: name, id, type: "name", matchLength: name.length};
        }
        // Case value Operator, AGGREGATION,
        if (text.startsWith(value)) {
          return {value, id: value, type: "value", matchLength: value.length};
        }
      }
    }
    return null;
  };

  while (remainingText.length > 0) {
    let match = findMatch(remainingText, OPERATOR);
    if (match) {
      result.push({type: "operator", value: match.value});
      remainingText = remainingText.slice(match.matchLength);
      continue;
    }

    match = findMatch(remainingText, AGGREGATION);
    if (match) {
      result.push({type: "aggregation", value: match.value});
      remainingText = remainingText.slice(match.matchLength);
      continue;
    }

    match = findMatch(remainingText, METRICS);
    if (match) {
      result.push({type: "metric", value: match.value, metricId: match.id});
      remainingText = remainingText.slice(match.matchLength);
      continue;
    }

    match = findMatch(remainingText, DIMENSIONS);
    if (match) {
      result.push({type: "dimension", value: match.value, dimensionId: match.id});
      remainingText = remainingText.slice(match.matchLength);
      continue;
    }

    let nextSpecialCharIndex = Math.min(
      ...[
        ...AGGREGATION.map(item => item.value),
        ...OPERATOR.map(item => item.value),
        ...OPERATOR.map(item => item.value),
        ...METRICS.map(item => item.name),
        ...METRICS.map(item => item.id),
        ...DIMENSIONS.map(item => item.name),
        ...DIMENSIONS.map(item => item.id)
      ]
      .map(op => remainingText.indexOf(op))
      .filter(index => index > -1),
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

export const convertTextToOther = (node, transactionData, pos) => {
  const splitContents = convertTextToToken(node?.textContent, METRICS, DIMENSIONS, OPERATOR);
  console.log("convertTextToOther: ", node?.textContent, splitContents, pos);

  if (!splitContents.length ||
    (splitContents.length === 1 && splitContents[0].type === node.type.name)
  )
  {
    return transactionData;
  }

  let start = transactionData.transaction.mapping.map(pos);
  console.log("rePosition", pos - start, pos - transactionData.cursor);
  transactionData.rePosition += (pos - start);
  try {
    transactionData.transaction.deleteRange(start, start + node.nodeSize);
  } catch (e) {
    console.warn(e.toString());
  }

  console.log(splitContents);
  splitContents.forEach((part, index) => {
    const {type, value} = part;

    if (value) {
      const textNode = schema.text(value);
      switch (type) {
        case "text":
        {
          transactionData.transaction.insert(start, textNode);
          start += textNode.nodeSize;
          transactionData.rePosition -= splitContents[index - 1]?.type !== "text" ? 0 : 1;
          break;
        }
        case "metric":
        {
          const metricNode = schema.nodes.metric.create({metricId: part.metricId}, textNode);
          transactionData.transaction.insert(start, metricNode);
          start += metricNode.nodeSize;
          transactionData.rePosition += metricNode.nodeSize - textNode.nodeSize - 1;
          break;
        }
        case "dimension":
        {
          const dimensionNode = schema.nodes.dimension.create({dimensionId: part.dimensionId}, textNode);
          transactionData.transaction.insert(start, dimensionNode);
          start += dimensionNode.nodeSize;
          transactionData.rePosition += dimensionNode.nodeSize - textNode.nodeSize - 1;
          break;
        }
        case "operator":
        {
          const operatorNode = schema.nodes.operator.create({operator: value});
          transactionData.transaction.insert(start, operatorNode);
          start += operatorNode.nodeSize;
          transactionData.rePosition += operatorNode.nodeSize - textNode.nodeSize;
          break;
        }
        case "aggregation":
        {
          const node = schema.nodes.aggregation.create({aggregation: value}, textNode);
          transactionData.transaction.insert(start, node);
          start += node.nodeSize;
          transactionData.rePosition += node.nodeSize - textNode.nodeSize;
          break;
        }
        default:
          break;
      }
    }
  });

  return transactionData;
};

export const convertOtherToText = (node, transactionData, pos) => {
  const nodeType = node?.type?.name;
  if (nodeType === "text") {
    console.warn("convertOtherToText: node is text");
    return transactionData;
  }
  const content = node?.textContent;
  console.log(`--convert [${nodeType}] To Text: "${content}"`, pos);

  switch (nodeType) {
    case "dimension":
    {
      const dimensionId = node?.attrs?.dimensionId;
      const dimension = DIMENSIONS.find(dim => dim.id === dimensionId && dim.name === content);
      if (!dimension) {
        return convertTextToOther(node, transactionData, pos);
      }
      break;
    }
    case "metric":
    {
      const metricId = node?.attrs?.metricId;
      const metric = METRICS.find(metric => metric.id === metricId && metric.name === content);
      if (!metric) {
        return convertTextToOther(node, transactionData, pos);
      }
      break;
    }
    case "operator":
    {
      const operator = node?.attrs?.operator;
      if (!OPERATOR.find(op => op.value === operator)) {
        return convertTextToOther(node, transactionData, pos);
      }
      break;
    }
    case "aggregation":
    {
      const aggregation = node?.attrs?.aggregation;
      if (!AGGREGATION.find(item => item.value === aggregation && item.value === content)) {
        return convertTextToOther(node, transactionData, pos);
      }
      break;
    }
    default:
      return transactionData;
  }

  return transactionData;
};
