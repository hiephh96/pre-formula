import {AGGREGATION, DIMENSIONS, METRICS, OPERATOR} from "@/shared/constants";
import {convertTextToOther, getTextNodeStartPosition} from "@/shared/helpers";
import {schema} from "@/shared/schema";
import {TextSelection} from "prosemirror-state";
import React, {useCallback, useEffect, useState} from "react";

export const getCurrentTextNode = (view) => {
  const {state} = view;
  const {selection} = state;
  const {$from} = selection;

  if ($from.nodeBefore && $from.nodeBefore.isText) {
    return $from.nodeBefore;
  }
  if ($from.nodeAfter && $from.nodeAfter.isText) {
    return $from.nodeAfter;
  }
  return undefined;
};

export function SuggestionPlugin({view}) {
  const [suggestions, setSuggestions] = useState([]);
  const [position, setPosition] = useState({top: 0, left: 0});
  const [selectedIndex, setSelectedIndex] = useState(0);

  const insertSuggestion = useCallback((suggestion) => {
    const {type, id, name} = suggestion;
    const {state, dispatch} = view;
    const {tr, selection} = state;
    const {$from, $to} = selection;

    let node;
    switch (type) {
      case "metric":
        node = schema.nodes.metric.create({metricId: id}, schema.text(name));
        break;
      case "dimension":
        node = schema.nodes.dimension.create({dimensionId: id}, schema.text(name));
        break;
      case "operator":
        node = schema.nodes.operator.create({operator: id});
        break;
      case "aggregation":
        node = schema.nodes.aggregation.create({aggregation: id}, schema.text(name));
        break;
      default:
        node = schema.text(suggestion.name);
        break;
    }

    let position = $from.pos;
    if ($from?.nodeBefore?.type.name === 'text') {
      position = getTextNodeStartPosition(view);
      tr.replaceWith(position, position + $from?.nodeBefore.nodeSize, node);
    } else {
      tr.insert(position, node);
    }

    try {
      tr.setSelection(TextSelection.create(tr.doc, position + node.nodeSize))
    } catch (e) {
      console.warn(e.toString());
    }

    dispatch(tr);
    view.focus();

    setSuggestions([]);
    setSelectedIndex(0);
  }, [view]);

  useEffect(() => {
    return () => {
      setSuggestions([]);
      setSelectedIndex(0);
    };
  }, []);

  useEffect(() => {
    if (!suggestions.length) return;

    const handleKeyDown = (event) => {
      if (suggestions.length > 0) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setSelectedIndex((prevIndex) => (prevIndex + 1) % suggestions.length);
          return true;
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          setSelectedIndex((prevIndex) => (prevIndex - 1 + suggestions.length) % suggestions.length);
          return true;
        } else if (event.key === "Enter") {
          event.preventDefault();
          insertSuggestion(suggestions[selectedIndex]);
          return true;
        }
      }
    };

    view.dom.addEventListener("keydown", handleKeyDown);
    return () => {
      view.dom.removeEventListener("keydown", handleKeyDown);
    };
  }, [view, suggestions, selectedIndex, insertSuggestion]);

  useEffect(() => {
    const handleInput = (event) => {
      const {state} = view;
      const {selection} = state;
      const {from, anchor} = selection;
      const node = getCurrentTextNode(view);
      const lowerText = node?.textContent?.toLowerCase() || '';

      console.log('>> lowerText', lowerText);
      const rect = view.coordsAtPos(anchor);
      setPosition({top: rect.bottom, left: rect.left});

      const suggestionData = [
        ...OPERATOR.map(item => ({type: "aggregation", name: item.value, id: item.value})),
        ...AGGREGATION.map(item => ({type: "aggregation", name: item.value, id: item.value})),
        ...METRICS.map(item => ({type: "metric", ...item})),
        ...DIMENSIONS.map(item => ({type: "dimension", ...item})),
      ].filter(item => item.name.toLowerCase().includes(lowerText.trimStart()))
      setSuggestions(suggestionData);

      console.log({suggestionData, from});
      if (suggestionData.length > 0) return;

      const replacePosition = getTextNodeStartPosition(view)
      console.log(replacePosition);
      let transactionData = {
        transaction: view.state.tr,
        cursor: replacePosition,
        rePosition: 0,
      };
      transactionData = convertTextToOther(node, transactionData, replacePosition);

      if (transactionData.transaction.docChanged) {
        // const mappedStart = replacePosition + transactionData.rePosition;
        // const newSelection = TextSelection.create(transactionData.transaction.doc, mappedStart, mappedStart);
        // transactionData.transaction.setSelection(newSelection);

        view.dispatch(transactionData.transaction);
      }
    };

    view.dom.addEventListener("input", handleInput);
    view.dom.addEventListener("focus", handleInput);
    return () => {
      view.dom.removeEventListener("input", handleInput);
      view.dom.removeEventListener("focus", handleInput);
    };
  }, [view]);

  useEffect(() => {
    const handleBlur = () => {
      setSuggestions([]);
      setSelectedIndex(0);
    }
    view.dom.addEventListener("blur", handleBlur);
    return () => {
      view.dom.removeEventListener("blur", handleBlur);
    };
  }, [view]);

  return (
    suggestions.length > 0 && (
      <div
        className="suggestion-list"
        style={{
          position: "absolute",
          top: position.top,
          left: position.left,
          border: "1px solid #ccc",
          background: "#fff",
          zIndex: 1000,
        }}>
        {suggestions.map((suggestion, index) => (
          <div
            key={suggestion.id || suggestion.value}
            onClick={() => insertSuggestion(suggestion)}
            style={{
              backgroundColor: selectedIndex === index ? "#bde4ff" : "#fff",
              padding: "5px 10px",
              cursor: "pointer",
            }}
          >
            <div className={`${suggestion.type}`}>
              {suggestion.name || suggestion.value}
            </div>
          </div>
        ))}
      </div>
    )
  );
}
