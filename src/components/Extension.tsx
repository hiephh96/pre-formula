import { mergeAttributes, Node, NodeViewRendererProps } from '@tiptap/core'
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import React from "react";

const ReactNode = (props: NodeViewRendererProps) => {
  return (
    <NodeViewWrapper className="react-component-with-content">
      <NodeViewContent className="content">
      </NodeViewContent>
    </NodeViewWrapper>
  )
}

const MetricNode = Node.create({
  name: 'metric',

  inline: true,

  selectable: true,

  atom: false,

  parseHTML() {
    return [
      {
        tag: 'react-component',
      },
    ]
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => {
        return this.editor.chain().insertContentAt(this.editor.state.selection.head, { type: this.type.name }).focus().run()
      },
    }
  },

  renderHTML({ HTMLAttributes }) {
    return ['react-component', mergeAttributes(HTMLAttributes), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ReactNode, { contentDOMElementTag: 'span' })
  },

  addAttributes() {
    return {
      id: {
        default: '',
        parseHTML: element => element.getAttribute('data-id'),
        renderHTML: attributes => {
          if (!attributes.id) {
            return {}
          }

          return {
            'data-id': attributes.id,
          }
        },
      },

      label: {
        default: '',
        parseHTML: element => element.getAttribute('data-label'),
        renderHTML: attributes => {
          if (!attributes.label) {
            return {}
          }

          return {
            'data-label': attributes.label,
          }
        },
      },
    }
  },
})

export default MetricNode
