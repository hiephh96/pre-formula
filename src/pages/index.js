import {convertDocToPlainText, CopyPastePlugin} from "@/plugin/CopyPastePlugin";
import {SuggestionPlugin} from "@/plugin/SuggestionPlugin";
import {convertOtherToText, convertTextToOther} from "@/shared/helpers";
import {schema} from "@/shared/schema";
import {exampleSetup} from "prosemirror-example-setup";
import "prosemirror-view/style/prosemirror.css";
import {keymap} from "prosemirror-keymap";
import {DOMParser} from "prosemirror-model";
import {EditorState, Plugin, TextSelection} from "prosemirror-state";
import {EditorView} from "prosemirror-view";
import React, {useEffect, useMemo, useRef, useState} from "react";

const ProseMirrorEditor = ({defaultValue}) => {
  const editorRef = useRef();
  const [view, setView] = useState();
  const [editorStateJson, setEditorStateJson] = useState("");

  useEffect(() => {
    const state = EditorState.create({
      doc: DOMParser.fromSchema(schema).parse("<p>Type something...</p>"),
      plugins: [
        keymap({
          // Skip enter
          Enter: (state, dispatch, view) => {
            return true;
          },
        }),
        new Plugin({
          props: {
            handleDOMEvents: {
              input(view, event) {
                const {state, dispatch} = view;
                const {doc, selection} = state;
                const {anchor, to} = selection;

                console.log("-----------------------");
                console.log(selection);
                console.log(">> doc.descendants at anchor: ", anchor);
                let transactionData = {
                  transaction: view.state.tr,
                  cursor: anchor,
                  rePosition: 0,
                };

                doc.descendants((node, pos, parent) => {
                  const shouldSkip = ["paragraph"].includes(node.type.name) ||
                    ["metric", "dimension", "aggregation"].includes(parent.type.name);

                  console.log(`>> node [${node.type.name}]: ${node?.textContent} shouldSkip: `, shouldSkip);
                  if (!shouldSkip) {
                    if (node.type.name === "text") {
                      transactionData = convertTextToOther(node, transactionData, pos);
                    } else {
                      transactionData = convertOtherToText(node, transactionData, pos);
                    }
                  }
                });

                console.log("docChanged", transactionData.transaction.docChanged, anchor, transactionData.rePosition);
                if (transactionData.transaction.docChanged) {
                  const mappedStart = anchor + transactionData.rePosition;
                  const newSelection = TextSelection.create(transactionData.transaction.doc, mappedStart, mappedStart);
                  transactionData.transaction.setSelection(newSelection);

                  dispatch(transactionData.transaction);
                  view.focus();
                  return true;
                }

                return false;
              },
            },
          },
        }),
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
