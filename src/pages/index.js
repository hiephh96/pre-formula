import {SuggestionPlugin} from "@/plugin/SuggestionPlugin";
import {DIMENSIONS, METRICS} from "@/shared/constants";
import {
  convertEditorStateToText,
  convertOtherToText,
  convertTextToDimension,
  convertTextToOperator,
  convertTextToOther,
  handleMetricInput,
} from "@/shared/helpers";
import {schema} from "@/shared/schema";
import {exampleSetup} from "prosemirror-example-setup";
import "prosemirror-view/style/prosemirror.css";
import {inputRules, textblockTypeInputRule} from "prosemirror-inputrules";
import {keymap} from "prosemirror-keymap";
import {DOMParser} from "prosemirror-model";
import {EditorState, Plugin} from "prosemirror-state";
import {EditorView} from "prosemirror-view";
import React, {useEffect, useMemo, useRef, useState} from "react";

const ProseMirrorEditor = () => {
  const editorRef = useRef();
  const [view, setView] = useState();
  const [editorStateJson, setEditorStateJson] = useState("");

  useEffect(() => {
    const state = EditorState.create({
      doc: DOMParser.fromSchema(schema).parse("<p>Type something...</p>"),
      plugins: [
        ...exampleSetup({schema}),
        keymap({
          "Mod-s": () => {
            console.log("Save");
            return true;
          },
          // Enter: (state, dispatch, view) => {
          //   console.log('enter', document.querySelector(".suggestion-list"));
          //   // Custom handling for Enter key
          //   return !!document.querySelector(".suggestion-list");
          //    // Allow default behavior if no suggestion list is present
          // },
        }),
        inputRules({
          rules: [
            textblockTypeInputRule(/^> $/, schema.nodes.blockquote),
          ],
        }),
        new Plugin({
          props: {
            handleDOMEvents: {
              // blur(view, event) {
              //   const {state, dispatch} = view;
              //   const {doc} = state;
              //   const tr = state.tr;
              //   doc.descendants((node, pos) => {
              //     if (node.isTextblock) {
              //       node.descendants((inlineNode, inlinePos) => {
              //         if (inlineNode.isText) {
              //           const text = inlineNode.text;
              //           const metricId = Object.keys(METRICS).find(id => METRICS[id] === text);
              //           const dimensionId = Object.keys(DIMENSIONS).find(id => DIMENSIONS[id] === text);
              //           if (metricId) {
              //             const metricNode = schema.nodes.metric.create({metricId});
              //             tr.replaceRangeWith(pos + inlinePos, pos + inlinePos + text.length, metricNode);
              //           } else if (dimensionId) {
              //             const dimensionNode = schema.nodes.dimension.create({dimensionId});
              //             tr.replaceRangeWith(pos + inlinePos, pos + inlinePos + text.length, dimensionNode);
              //           }
              //         }
              //       });
              //     }
              //   });
              //   dispatch(tr);
              //   return false;
              // },
              input(view, event) {
                const {state, dispatch} = view;
                const {doc} = state;
                console.log(">> doc.descendants");
                let transaction = view.state.tr;
                doc.descendants((node, pos, parent) => {
                  const shouldSkip = !["metric", "dimension", "operator", "text"].includes(node.type.name) ||
                    ["metric", "dimension"].includes(parent.type.name);

                  console.log(`>> node [${node.type.name}]: ${node?.textContent} shouldSkip: `, shouldSkip);
                  if (!shouldSkip) {
                    if (node.type.name === "text") {
                      transaction = convertTextToOther(node, transaction, pos);
                    } else {
                      transaction = convertOtherToText(node, transaction, pos);
                    }
                  }
                });

                console.log("docChanged", transaction.docChanged);
                if (transaction.docChanged) {
                  dispatch(transaction);
                  return true;
                }

                return false;
              },
              _input(view, event) {
                const {state, dispatch} = view;
                const {selection} = state;
                const {from, to} = selection;
                const node = state.doc.nodeAt(from);

                if (!node) return false;

                console.log({
                  from, to, node,
                });

                let tr = state.tr;

                if (node.type.name === "text") {
                  const textContent = node.textContent.trim();

                  // Handle binary operator input
                  if (convertTextToOperator(view, from, to, textContent)) {
                    return true;
                  }

                  // Handle metric input
                  if (handleMetricInput(view, from, to, textContent)) {
                    return true;
                  }

                  // Handle dimension input
                  if (convertTextToDimension(view, from, to, textContent)) {
                    return true;
                  }
                }

                if (node.type.name === "metric" || node.type.name === "dimension") {
                  const textContent = node.textContent;
                  const matchedMetricId = Object.keys(METRICS).find(id => textContent.startsWith(METRICS[id]));
                  const matchedDimensionId = Object.keys(DIMENSIONS).find(id => textContent.startsWith(DIMENSIONS[id]));

                  if (matchedMetricId) {
                    const newMetricNode = schema.nodes.metric.create({metricId: matchedMetricId}, schema.text(METRICS[matchedMetricId]));
                    tr = tr.replaceRangeWith(from - node.nodeSize + 1, from + 1, newMetricNode);
                    const newPos = from - node.nodeSize + newMetricNode.nodeSize;
                    tr = tr.setSelection(EditorState.create(state).selection.constructor.near(tr.doc.resolve(newPos)));
                    const remainingText = textContent.slice(METRICS[matchedMetricId].length);
                    if (remainingText) {
                      const textNode = schema.text(remainingText);
                      tr = tr.insert(newPos + 1, textNode);
                    }
                    dispatch(tr);
                    return true;
                  } else if (matchedDimensionId) {
                    const newDimensionNode = schema.nodes.dimension.create({dimensionId: matchedDimensionId}, schema.text(DIMENSIONS[matchedDimensionId]));
                    tr = tr.replaceRangeWith(from - node.nodeSize + 1, from + 1, newDimensionNode);
                    const newPos = from - node.nodeSize + newDimensionNode.nodeSize;
                    tr = tr.setSelection(EditorState.create(state).selection.constructor.near(tr.doc.resolve(newPos)));
                    const remainingText = textContent.slice(DIMENSIONS[matchedDimensionId].length);
                    if (remainingText) {
                      const textNode = schema.text(remainingText);
                      tr = tr.insert(newPos + 1, textNode);
                    }
                    dispatch(tr);
                    return true;
                  }
                }

                if (tr.docChanged) {
                  dispatch(tr);
                }

                return false;
              },
            },
          },
        }),
      ],
      //defaultText: 'Type something...',
    });

    const view = new EditorView(editorRef.current, {
      state,
      dispatchTransaction(transaction) {
        const newState = view.state.apply(transaction);
        view.updateState(newState);
        setView(view);

        setEditorStateJson(JSON.stringify(newState.toJSON(), null, 2));
      },
    });

    setView(view);
    return () => view.destroy();
  }, []);

  useEffect(() => {
    return () => {
      setEditorStateJson("");
    };
  }, []);

  const textContent = useMemo(() => {
    return convertEditorStateToText(view);
  }, [view?.state?.doc]);

  return (
    <div className="w-full p-10">
      <div ref={editorRef} className="border bg-gray-50 p-2 rounded !outline-0"></div>
      <div className="bg-amber-50">
        <code>{textContent}</code>
      </div>
      {view && <SuggestionPlugin view={view}/>}

      <pre>{editorStateJson}</pre>
    </div>
  );
};

export default function Home() {
  return (
    <ProseMirrorEditor/>
  );
}
