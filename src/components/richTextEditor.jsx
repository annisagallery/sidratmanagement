'use client';
import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import {
  FiBold,
  FiItalic,
  FiUnderline,
  FiList,
  FiLink,
  FiImage,
  FiRotateCcw,
  FiRotateCw,
  FiMinus,
  FiAlignLeft,
  FiAlignCenter,
  FiAlignRight
} from 'react-icons/fi';
import { BsListOl, BsBlockquoteLeft, BsTypeStrikethrough } from 'react-icons/bs';
import { MdOutlineFormatColorText, MdOutlineHighlight, MdGridOn, MdFormatClear } from 'react-icons/md';

/**
 * Shared Tiptap rich-text editor. Controlled by an HTML string: `value` in,
 * `onChange(html)` out — a drop-in replacement for the old ReactQuill usage.
 *
 * Extensions must cover every node/mark that saved content can contain —
 * anything Tiptap doesn't recognize is dropped from the document (and would
 * be silently lost on save). Hence images, tables, alignment, color and
 * highlight are included alongside the StarterKit basics.
 */
export default function RichTextEditor({ value, onChange, placeholder = 'Write here…', minHeight = 220 }) {
  const colorInputRef = useRef(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' }
      }),
      TextStyleKit,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight,
      Image.configure({ inline: false }),
      TableKit.configure({ table: { resizable: false } })
    ],
    content: value || '',
    // Next.js SSR: skip the server render pass to avoid hydration mismatch
    immediatelyRender: false,
    // Re-render the toolbar active states on every transaction
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none px-3 py-2',
        style: `min-height:${minHeight}px`
      }
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML())
  });

  // Sync external value changes (form reset, loading saved data) without
  // clobbering the caret while the user is typing in this editor.
  useEffect(() => {
    if (!editor) return;
    const incoming = value || '';
    if (editor.isFocused) return;
    if (incoming !== editor.getHTML() && !(editor.isEmpty && !incoming)) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return <div className="border border-gray-200 rounded-md bg-gray-50" style={{ minHeight: minHeight + 41 }} />;
  }

  const setLink = () => {
    const previous = editor.getAttributes('link').href || '';
    // eslint-disable-next-line no-alert
    const url = window.prompt('Link URL (leave empty to remove)', previous);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const addImage = () => {
    // eslint-disable-next-line no-alert
    const src = window.prompt('Image URL');
    if (src) editor.chain().focus().setImage({ src }).run();
  };

  const inTable = editor.isActive('table');

  const Btn = ({ onClick, active, label, children }) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`h-8 min-w-8 px-1.5 rounded-md flex items-center justify-center text-[13px] transition ${
        active ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {children}
    </button>
  );

  const Divider = () => <span className="mx-1 h-5 w-px bg-gray-200" />;

  return (
    <div className="border border-gray-200 rounded-md bg-white focus-within:border-gray-400">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-100 px-1.5 py-1">
        {[1, 2, 3].map((level) => (
          <Btn
            key={level}
            label={`Heading ${level}`}
            active={editor.isActive('heading', { level })}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          >
            <span className="font-bold">H{level}</span>
          </Btn>
        ))}
        <Divider />
        <Btn label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <FiBold />
        </Btn>
        <Btn
          label="Italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <FiItalic />
        </Btn>
        <Btn
          label="Underline"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <FiUnderline />
        </Btn>
        <Btn
          label="Strikethrough"
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <BsTypeStrikethrough />
        </Btn>
        <Btn
          label="Highlight"
          active={editor.isActive('highlight')}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <MdOutlineHighlight />
        </Btn>
        <Btn
          label="Text color"
          active={Boolean(editor.getAttributes('textStyle').color)}
          onClick={() => colorInputRef.current?.click()}
        >
          <MdOutlineFormatColorText style={{ color: editor.getAttributes('textStyle').color || undefined }} />
        </Btn>
        <input
          ref={colorInputRef}
          type="color"
          className="sr-only"
          value={editor.getAttributes('textStyle').color || '#000000'}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />
        <Btn label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
          <MdFormatClear />
        </Btn>
        <Divider />
        <Btn
          label="Align left"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().toggleTextAlign('left').run()}
        >
          <FiAlignLeft />
        </Btn>
        <Btn
          label="Align center"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().toggleTextAlign('center').run()}
        >
          <FiAlignCenter />
        </Btn>
        <Btn
          label="Align right"
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().toggleTextAlign('right').run()}
        >
          <FiAlignRight />
        </Btn>
        <Divider />
        <Btn
          label="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <FiList />
        </Btn>
        <Btn
          label="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <BsListOl />
        </Btn>
        <Btn
          label="Quote"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <BsBlockquoteLeft />
        </Btn>
        <Btn label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <FiMinus />
        </Btn>
        <Btn label="Link" active={editor.isActive('link')} onClick={setLink}>
          <FiLink />
        </Btn>
        <Btn label="Image from URL" onClick={addImage}>
          <FiImage />
        </Btn>
        <Btn
          label={inTable ? 'Delete table' : 'Insert table'}
          active={inTable}
          onClick={() =>
            inTable
              ? editor.chain().focus().deleteTable().run()
              : editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
        >
          <MdGridOn />
        </Btn>
        {inTable && (
          <>
            <Btn label="Add row below" onClick={() => editor.chain().focus().addRowAfter().run()}>
              <span className="text-[11px] font-bold">+Row</span>
            </Btn>
            <Btn label="Add column after" onClick={() => editor.chain().focus().addColumnAfter().run()}>
              <span className="text-[11px] font-bold">+Col</span>
            </Btn>
          </>
        )}
        <Divider />
        <Btn label="Undo" onClick={() => editor.chain().focus().undo().run()}>
          <FiRotateCcw />
        </Btn>
        <Btn label="Redo" onClick={() => editor.chain().focus().redo().run()}>
          <FiRotateCw />
        </Btn>
      </div>
      <EditorContent editor={editor} placeholder={placeholder} />
    </div>
  );
}

RichTextEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  minHeight: PropTypes.number
};
