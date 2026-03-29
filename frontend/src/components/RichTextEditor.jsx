import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { TextAlign } from "@tiptap/extension-text-align";
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Image as ImageIcon, Link as LinkIcon, Link2Off, Table as TableIcon,
  Minus, Palette, Highlighter, Plus, Trash2, Columns, Rows3, TableCellsMerge, TableCellsSplit
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const ToolbarBtn = ({ title, active, onClick, disabled, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" disabled={disabled} onClick={onClick} className={`p-1.5 rounded-md transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed ${active ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"}`}>
        {children}
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="text-xs">{title}</TooltipContent>
  </Tooltip>
);

const Sep = () => <div className="w-px h-5 bg-border/50 mx-0.5" />;

const RichTextEditor = ({ value, onChange, placeholder = "Compose your email..." }) => {
  const [tick, setTick] = useState(0);
  const rerender = useCallback(() => setTick((t) => t + 1), []);
  const colorRef = useRef(null);
  const highlightRef = useRef(null);
  const [inTable, setInTable] = useState(false);
  const isInternalChange = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit, TextStyle, Color, Highlight.configure({ multicolor: true }), Image,
      Link.configure({ openOnClick: false, autolink: true }), Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true }), TableRow, TableHeader, TableCell,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      isInternalChange.current = true;
      onChange?.(editor.getJSON());
      rerender();
      setInTable(editor.isActive("table"));
    },
    onSelectionUpdate: ({ editor }) => {
      rerender();
      setInTable(editor.isActive("table"));
      if (!editor.isActive("link")) { editor.commands.unsetMark("link"); }
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (isInternalChange.current) { isInternalChange.current = false; return; }
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(value);
    if (current !== incoming) editor.commands.setContent(value || "");
  }, [value, editor]);

  if (!editor) return null;

  const is = (name, attrs) => editor.isActive(name, attrs);
  const chain = () => editor.chain().focus();
  const addImage = () => { const url = window.prompt("Enter image URL"); if (url) chain().setImage({ src: url }).run(); };
  const addLink = () => {
    const url = window.prompt("Enter link URL");
    if (url) { chain().extendMarkRange("link").setLink({ href: url }).run(); editor.commands.selectTextblockEnd(); editor.commands.unsetMark("link"); }
  };

  const sz = "h-3.5 w-3.5";

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden bg-background shadow-sm">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border/40 bg-secondary/20">
        <ToolbarBtn title="Bold" active={is("bold")} onClick={() => chain().toggleBold().run()}><Bold className={sz} /></ToolbarBtn>
        <ToolbarBtn title="Italic" active={is("italic")} onClick={() => chain().toggleItalic().run()}><Italic className={sz} /></ToolbarBtn>
        <ToolbarBtn title="Strikethrough" active={is("strike")} onClick={() => chain().toggleStrike().run()}><Strikethrough className={sz} /></ToolbarBtn>
        <ToolbarBtn title="Code" active={is("code")} onClick={() => chain().toggleCode().run()}><Code className={sz} /></ToolbarBtn>
        <Sep />
        <ToolbarBtn title="Heading 1" active={is("heading", { level: 1 })} onClick={() => chain().toggleHeading({ level: 1 }).run()}><Heading1 className={sz} /></ToolbarBtn>
        <ToolbarBtn title="Heading 2" active={is("heading", { level: 2 })} onClick={() => chain().toggleHeading({ level: 2 }).run()}><Heading2 className={sz} /></ToolbarBtn>
        <ToolbarBtn title="Heading 3" active={is("heading", { level: 3 })} onClick={() => chain().toggleHeading({ level: 3 }).run()}><Heading3 className={sz} /></ToolbarBtn>
        <Sep />
        <ToolbarBtn title="Bullet List" active={is("bulletList")} onClick={() => chain().toggleBulletList().run()}><List className={sz} /></ToolbarBtn>
        <ToolbarBtn title="Numbered List" active={is("orderedList")} onClick={() => chain().toggleOrderedList().run()}><ListOrdered className={sz} /></ToolbarBtn>
        <Sep />
        <ToolbarBtn title="Align Left" active={is({ textAlign: "left" })} onClick={() => chain().setTextAlign("left").run()}><AlignLeft className={sz} /></ToolbarBtn>
        <ToolbarBtn title="Align Center" active={is({ textAlign: "center" })} onClick={() => chain().setTextAlign("center").run()}><AlignCenter className={sz} /></ToolbarBtn>
        <ToolbarBtn title="Align Right" active={is({ textAlign: "right" })} onClick={() => chain().setTextAlign("right").run()}><AlignRight className={sz} /></ToolbarBtn>
        <ToolbarBtn title="Justify" active={is({ textAlign: "justify" })} onClick={() => chain().setTextAlign("justify").run()}><AlignJustify className={sz} /></ToolbarBtn>
        <Sep />
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={() => colorRef.current?.click()} className="relative p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent transition-all">
              <Palette className={sz} />
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full" style={{ backgroundColor: editor.getAttributes("textStyle").color || "currentColor" }} />
              <input ref={colorRef} type="color" defaultValue="#000000" className="hidden" onChange={(e) => chain().setColor(e.target.value).run()} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Text Color</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" onClick={() => highlightRef.current?.click()} className="relative p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent transition-all">
              <Highlighter className={sz} />
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full" style={{ backgroundColor: editor.getAttributes("highlight").color || "#ffff00" }} />
              <input ref={highlightRef} type="color" defaultValue="#ffff00" className="hidden" onChange={(e) => chain().setHighlight({ color: e.target.value }).run()} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Highlight</TooltipContent>
        </Tooltip>
        <Sep />
        <ToolbarBtn title="Image" onClick={addImage}><ImageIcon className={sz} /></ToolbarBtn>
        <ToolbarBtn title="Link" active={is("link")} onClick={addLink}><LinkIcon className={sz} /></ToolbarBtn>
        {is("link") && <ToolbarBtn title="Remove Link" onClick={() => chain().extendMarkRange("link").unsetLink().run()}><Link2Off className={sz} /></ToolbarBtn>}
        <ToolbarBtn title="Horizontal Rule" onClick={() => chain().setHorizontalRule().run()}><Minus className={sz} /></ToolbarBtn>
        <Sep />
        <ToolbarBtn title="Insert Table" active={inTable} onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon className={sz} /></ToolbarBtn>
      </div>
      {inTable && (
        <div className="flex flex-wrap items-center gap-0.5 px-2 py-1 border-b border-border/40 bg-primary/5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-primary mr-1">TABLE</span>
          <Sep />
          <ToolbarBtn title="Add Row" onClick={() => chain().addRowAfter().run()}><Plus className={sz} /></ToolbarBtn>
          <ToolbarBtn title="Delete Row" onClick={() => chain().deleteRow().run()}><Rows3 className={sz} /></ToolbarBtn>
          <Sep />
          <ToolbarBtn title="Add Column" onClick={() => chain().addColumnAfter().run()}><Columns className={sz} /></ToolbarBtn>
          <ToolbarBtn title="Delete Column" onClick={() => chain().deleteColumn().run()}><Trash2 className={sz} /></ToolbarBtn>
          <Sep />
          <ToolbarBtn title="Merge Cells" onClick={() => chain().mergeCells().run()}><TableCellsMerge className={sz} /></ToolbarBtn>
          <ToolbarBtn title="Split Cell" onClick={() => chain().splitCell().run()}><TableCellsSplit className={sz} /></ToolbarBtn>
          <Sep />
          <ToolbarBtn title="Delete Table" onClick={() => chain().deleteTable().run()}><Trash2 className="h-3.5 w-3.5 text-destructive" /></ToolbarBtn>
        </div>
      )}
      <div className="px-4 py-3  [&_.ProseMirror]:min-h-[180px] [&_.ProseMirror]:outline-none [&_.ProseMirror]:text-sm [&_.ProseMirror]:leading-relaxed [&_.ProseMirror]:text-foreground [&_.ProseMirror_p]:mb-1.5 [&_.ProseMirror_p.is-editor-empty:first-of-type::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-of-type::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-of-type::before]:text-muted-foreground/40 [&_.ProseMirror_p.is-editor-empty:first-of-type::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-of-type::before]:h-0 [&_.ProseMirror_h1]:text-xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mt-3 [&_.ProseMirror_h1]:mb-1 [&_.ProseMirror_h2]:text-lg [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:mt-2.5 [&_.ProseMirror_h2]:mb-1 [&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mt-2 [&_.ProseMirror_h3]:mb-1 [&_.ProseMirror_ul]:pl-5 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:my-1 [&_.ProseMirror_ol]:pl-5 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:my-1 [&_.ProseMirror_li]:my-0.5 [&_.ProseMirror_li>p]:m-0 [&_.ProseMirror_a]:text-primary [&_.ProseMirror_a]:underline [&_.ProseMirror_hr]:border-border/30 [&_.ProseMirror_hr]:my-4 [&_.ProseMirror_code]:bg-secondary [&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:font-mono [&_.ProseMirror_code]:text-xs [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:my-3 [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-border [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:bg-secondary/50 [&_.ProseMirror_th]:font-semibold [&_.ProseMirror_th]:text-left [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-border [&_.ProseMirror_td]:p-2 [&_.ProseMirror_td]:text-left [&_.ProseMirror_.selectedCell]:bg-primary/10">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default RichTextEditor;
