import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import React from 'react'
import MetricNode from "@/components/Extension";

const App = () => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      MetricNode,
    ],
    autofocus: true,
    content: `
    <react-component dataLabel="abc" dataId="123456">
     React component
</react-component>
    <span>
      Did you see that? That’s a React component. We are really living in the future.
    </span>
    `,
  })

  console.log(editor?.getJSON())
  return (
    <>
      <div className='p-5 bg-amber-50 border-amber-500 rounded-lg'>
        <EditorContent
          editor={editor}
        />
      </div>

      <div className='flex flex-row gap-2'>
        {/*<div className='p-5 flex-1'>*/}
        {/*  Whole state*/}
        {/*  <ReactJson src={editor?.getJSON() || {}}/>*/}
        {/*</div>*/}

        {/*<div className='p-5 flex-1'>*/}
        {/*  Selected Metric*/}
        {/*  <ReactJson src={editor?.getAttributes('metric') || {}}/>*/}
        {/*</div>*/}
      </div>
    </>
  )
}

export default App
