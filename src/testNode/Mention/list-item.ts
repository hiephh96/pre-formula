import { mergeAttributes, Node } from '@tiptap/core'

export const ListItem = Node.create({
  name: 'metric',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  // addAttributes() {
  //   return {
  //     id: {
  //       default: null,
  //       parseHTML: element => element.getAttribute('data-id'),
  //       renderHTML: attributes => {
  //         if (!attributes.id) {
  //           return {}
  //         }
  //
  //         return {
  //           'data-id': attributes.id,
  //         }
  //       },
  //     },
  //   }
  // },

  content: 'inline*',

  defining: true,

  parseHTML() {
    return [
      {
        tag: 'div',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      class: 'border border-gray-500 rounded-sm inline w-fit'
    }), 0]
  },

  addKeyboardShortcuts() {
    return {
      "(": () => {
        console.log('co vao day')
        return this.editor.commands.splitListItem(this.name)
      },
      "Space": () => this.editor.commands.splitListItem(this.name),
      "Tab": () => this.editor.commands.sinkListItem(this.name),
      'Shift-Tab': () => this.editor.commands.liftListItem(this.name),
    }
  },
})
