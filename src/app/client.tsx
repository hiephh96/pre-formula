import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import React, { useEffect } from 'react'
import { JSONTree } from "react-json-tree";
import { ListItem } from "@/testNode/Mention/list-item";

const App = () => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      // MetricNode,
      // Mention.configure({
      //   HTMLAttributes: {
      //     class: 'mention',
      //   },
      //   suggestion,
      //   deleteTriggerWithBackspace: true,
      // }),
      ListItem,
    ],
    autofocus: true,
    onUpdate(data) {
      console.log('onUpdate', data)
      // The content has changed.
    },
    onSelectionUpdate(data) {
      console.log('onSelectionUpdate', data)
      // The selection has changed.
    },
    onTransaction(data) {
      console.log('onTransaction', data)
      // The editor state has changed.
    },
  })

  useEffect(() => {
    editor?.commands.setContent({
      "type": "doc",
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              type: "metric",
              attrs: {
                id: 'abc',
                label: "aaa"
              },
              "content": [
                {
                  "type": "text",
                  "text": "SUM"
                }
              ]
            },
            {
              type: "metric",
              attrs: {
                id: 'abc',
                label: "aaa"
              },
              "content": [
                {
                  "type": "text",
                  "text": "Internet sales"
                }
              ]
            }
          ]
        },
      ]
    })
  }, [editor]);

  return (
    <>
      <div className='bg-amber-50 border-amber-500 rounded-lg'>
        <EditorContent
          className='p-5'
          editor={editor}
        />
      </div>

      <div className='flex flex-row gap-2'>
        <div className='p-5 flex-1'>
          Whole state
          <JSONTree data={editor?.getJSON() || {}} shouldExpandNodeInitially={() => true}/>
        </div>

        {/*<div className='p-5 flex-1'>*/}
        {/*  Selected Metric*/}
        {/*  <ReactJson src={editor?.getAttributes('metric') || {}}/>*/}
        {/*</div>*/}
      </div>
    </>
  )
}

export default App
