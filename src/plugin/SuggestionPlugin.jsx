import {DIMENSIONS, METRICS} from "@/shared/constants";
import {schema} from "@/shared/schema";
import React, {useCallback, useEffect, useState} from "react";

export function SuggestionPlugin({view}) {
  const [suggestions, setSuggestions] = useState([]);
  const [position, setPosition] = useState({top: 0, left: 0});
  const [selectedIndex, setSelectedIndex] = useState(0);

  const insertSuggestion = useCallback((suggestion) => {
    console.log("insertSuggestion", suggestion);
    const {state, dispatch} = view;
    const {selection} = state;
    const {from, to} = selection;

    const node = suggestion.type === "metric"
      ? schema.nodes.metric.create({metricId: suggestion.id}, schema.text(suggestion.name))
      : schema.nodes.dimension.create({dimensionId: suggestion.id}, schema.text(suggestion.name));

    const transaction = state.tr.replaceRangeWith(from, to, node);
    dispatch(transaction);

    // Focus the editor view after inserting the suggestion
    view.focus();

    setSuggestions([]);
    setSelectedIndex(0);
  }, [view]);

  useEffect(() => {
    return () => {
      setSuggestions([]);
      setSelectedIndex(0);
    }
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
      const text = state.doc.textBetween(0, from, " ");

      if (text.endsWith("")) {
        const rect = view.coordsAtPos(from);
        setPosition({top: rect.bottom, left: rect.left});
        setSuggestions([
          ...METRICS.map(metric => ({type: "metric", ...metric})),
          ...DIMENSIONS.map(dim => ({type: "dimension", ...dim})),
        ]);
      } else {
        setSuggestions([]);
      }
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
            key={suggestion.id}
            onClick={() => insertSuggestion(suggestion)}
            style={{
              backgroundColor: selectedIndex === index ? "#bde4ff" : "#fff",
              padding: "5px 10px",
              cursor: "pointer",
            }}
          >
            {suggestion.name}
          </div>
        ))}
      </div>
    )
  );
}
