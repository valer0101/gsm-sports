'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

function ToolbarButton({
  onClick,
  active,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="px-2.5 py-1.5 rounded text-sm font-medium transition-colors"
      style={{
        backgroundColor: active ? 'var(--color-accent)' : 'transparent',
        color: active ? 'white' : 'var(--color-text-secondary)',
      }}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({ value, onChange, placeholder }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const insertImageFromFile = async (file: File) => {
    if (!editor) return;
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/upload/image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      editor
        .chain()
        .focus()
        .setImage({ src: (res as any).data.url })
        .run();
    } catch {
      // silently fail — user sees no image inserted
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder }),
    ],
    immediatelyRender: false,
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[300px] prose prose-invert max-w-none',
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false);
    }
  }, [value]);

  if (!editor) return null;

  const addImage = () => fileInputRef.current?.click();

  const setLink = () => {
    const url = window.prompt('URL:');
    if (url) editor.chain().focus().setLink({ href: url }).run();
    else editor.chain().focus().unsetLink().run();
  };

  return (
    <div className="rounded-xl border border-white/15 overflow-hidden bg-[var(--color-background)]">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-0.5 px-3 py-2 border-b border-white/10 bg-[var(--color-secondary)]">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
        >
          <s>S</s>
        </ToolbarButton>

        <div className="w-px mx-1 self-stretch bg-white/10" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
        >
          H3
        </ToolbarButton>

        <div className="w-px mx-1 self-stretch bg-white/10" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
        >
          • List
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
        >
          1. List
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
        >
          ❝
        </ToolbarButton>

        <div className="w-px mx-1 self-stretch bg-white/10" />

        <ToolbarButton onClick={setLink} active={editor.isActive('link')}>
          🔗
        </ToolbarButton>
        <ToolbarButton onClick={addImage}>🖼</ToolbarButton>

        <div className="w-px mx-1 self-stretch bg-white/10" />

        <ToolbarButton onClick={() => editor.chain().focus().undo().run()}>↩</ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()}>↪</ToolbarButton>
      </div>

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) insertImageFromFile(file);
          e.target.value = '';
        }}
      />

      {/* Editor */}
      <div className="px-5 py-4">
        <style>{`
          .ProseMirror p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            color: var(--color-text-secondary);
            pointer-events: none;
            height: 0;
          }
          .ProseMirror h1 { font-size: 1.8rem; font-weight: 800; margin: 1rem 0 0.5rem; color: white; }
          .ProseMirror h2 { font-size: 1.4rem; font-weight: 700; margin: 0.8rem 0 0.4rem; color: white; }
          .ProseMirror h3 { font-size: 1.1rem; font-weight: 600; margin: 0.6rem 0 0.3rem; color: white; }
          .ProseMirror p { margin: 0.4rem 0; color: rgba(255,255,255,0.85); line-height: 1.7; }
          .ProseMirror ul, .ProseMirror ol { padding-left: 1.5rem; color: rgba(255,255,255,0.85); }
          .ProseMirror li { margin: 0.2rem 0; }
          .ProseMirror blockquote { border-left: 3px solid var(--color-accent); padding-left: 1rem; margin: 0.5rem 0; color: var(--color-text-secondary); }
          .ProseMirror a { color: var(--color-accent); text-decoration: underline; }
          .ProseMirror img { max-width: 100%; border-radius: 8px; margin: 0.5rem 0; }
          .ProseMirror strong { color: white; }
        `}</style>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
