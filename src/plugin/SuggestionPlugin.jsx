import {AGGREGATION, DIMENSIONS, METRICS} from "@/shared/constants";
import {schema} from "@/shared/schema";
import {TextSelection} from "prosemirror-state";
import React, {useCallback, useEffect, useState} from "react";

export const getCurrentTextNodeContent = (view) => {
  const {state} = view;
  const {selection} = state;
  const {$from} = selection;

  if ($from.nodeBefore && $from.nodeBefore.isText) {
    return $from.nodeBefore.textContent;
  }
  if ($from.nodeAfter && $from.nodeAfter.isText) {
    return $from.nodeAfter.textContent;
  }
  return "";
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

    let newPos = $from.pos
    if ($from?.nodeBefore?.type.name === 'text') {
      const newPos = $from.pos - ($from.nodeBefore ? $from.nodeBefore.nodeSize : 0);
      tr.replaceWith(newPos, newPos + ($from.nodeBefore ? $from.nodeBefore.nodeSize : 0), node);
    } else {
      tr.insert(newPos, node);
    }

    try {
      tr.setSelection(TextSelection.create(tr.doc, newPos + node.nodeSize))
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
      const {from} = selection;
      const lowerText = getCurrentTextNodeContent(view).toLowerCase();
      console.log('>> lowerText', lowerText);
      const rect = view.coordsAtPos(from);
      setPosition({top: rect.bottom, left: rect.left});
      setSuggestions([
        ...AGGREGATION.map(item => ({type: "aggregation", name: item.value, id: item.value})),
        ...METRICS.map(item => ({type: "metric", ...item})),
        ...DIMENSIONS.map(item => ({type: "dimension", ...item})),
      ].filter(item => item.name.toLowerCase().includes(lowerText)));
    };

    view.dom.addEventListener("input", handleInput);
    return () => {
      view.dom.removeEventListener("input", handleInput);
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
