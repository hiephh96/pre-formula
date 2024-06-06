import {convertDocToPlainText, CopyPastePlugin} from "@/plugin/CopyPastePlugin";
import {getCurrentTextNode, SuggestionPlugin} from "@/plugin/SuggestionPlugin";
import {
  convertNodeToText2,
  convertTextToOther,
  getFocusNode,
  getTextNodeStartPosition,
  handleKeyboardEvent,
} from "@/shared/helpers";
import {schema} from "@/shared/schema";
import {StoreProvider, useStore} from "@/store";
import {exampleSetup} from "prosemirror-example-setup";
import "prosemirror-view/style/prosemirror.css";
import {keymap} from "prosemirror-keymap";
import {DOMParser} from "prosemirror-model";
import {EditorState, Plugin, TextSelection} from "prosemirror-state";
import {EditorView} from "prosemirror-view";
import React, {memo, useEffect, useMemo, useRef, useState} from "react";

const ProseMirrorEditor = () => {
  const editorRef = useRef();
  const [view, setView] = useState();
  const [editorStateJson, setEditorStateJson] = useState("");

  const {allOptions, suggestionOptions} = useStore(state => ({
    allOptions: state.options,
    suggestionOptions: state.suggestionOptions,
  }));

  useEffect(() => {
    const state = EditorState.create({
      doc: DOMParser.fromSchema(schema).parse("<p>Type something...</p>"),
      plugins: [
        keymap({
          // Skip enter
          Enter: (state, dispatch, view) => {
            return true;
          },
          "Delete": (state, dispatch, view) => {
            const {$cursor} = state.selection;
            if ($cursor) {
              console.log("trigger Delete", state.doc.nodeAt($cursor.pos));
              const node = state.doc.nodeAt($cursor.pos);
              if (node && node.textContent.length > 0) {
                // If the node has content, convert it to a text node
                convertNodeToText2(state, dispatch);
              }
            }
            return false; // Fall back to default delete behavior
          },
          "Backspace": (state, dispatch, view) => {
            const {node: focusNode, pos} = getFocusNode(view);
            const tr = state.tr;
            console.log("trigger Backspace: ", focusNode?.textContent, pos);
            if (focusNode?.textContent) {
              tr.deleteRange(pos, pos + focusNode.nodeSize);
              tr.insert(pos, schema.text(focusNode.textContent));
              dispatch(tr);
            }
            return false;
          },
        }),
        new Plugin({
          props: {
            handleKeyDown(view, event) {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                const node = getCurrentTextNode(view.state);
                if (!node) return false

                const replacePosition = getTextNodeStartPosition(view.state)
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
              }
              return false;
            },
            handleDOMEvents: {
              input(view, event) {
                return handleKeyboardEvent(view, event);
              },
            },
          },
        }),
        // CursorMovementPlugin,
        CopyPastePlugin,
        ...exampleSetup({
          schema,
          menuBar: false,
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
    return convertDocToPlainText(view?.state?.doc);
  }, [view?.state?.doc]);

  return (
    <div className="w-full p-10">
      <div ref={editorRef} className="border bg-gray-50 p-2 rounded !outline-0"></div>
      <div className="bg-amber-50">
        <code>{textContent}</code>
      </div>
      {!!view && <SuggestionPlugin view={view}/>}

      <pre>{editorStateJson}</pre>
    </div>
  );
};

const FormulaEditor = (props) => {
  const {metrics, dimensions, aggregation, operator} = props;
  return (
    <StoreProvider
      metrics={metrics}
      dimensions={dimensions}
      aggregation={aggregation}
      operator={operator}
    >
      <ProseMirrorEditor/>
    </StoreProvider>
  );
};

export default memo(FormulaEditor);
