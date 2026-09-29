"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Folder,
  File,
  FileText,
  FileCode,
  FileImage,
  FileJson,
  Upload,
  FolderPlus,
  FilePlus,
  Trash2,
  Download,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Home,
  AlertTriangle,
  Pencil,
  Save,
  X,
  Search,
  Eye,
  FileArchive,
  FileType,
  Copy,
  Check,
  LayoutGrid,
  LayoutList,
  ArrowUpDown,
  Info,
  Clock,
  FileIcon,
  MoreVertical,
  HardDrive,
  Plus,
  Minus,
  FolderUp,
  Clipboard,
  Scissors,
  Files,
  TerminalSquare,
  Lock,
  Unlock,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Keyboard,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FileSpreadsheet,
  Settings,
  EyeOff,
  Package,
  FolderArchive,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import CodeEditor from "@uiw/react-textarea-code-editor";
import dynamic from "next/dynamic";

// Dynamic import for PDF viewer (heavy component)
const PDFViewer = dynamic(() => import("./pdf-viewer").then(mod => mod.PDFViewer), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Spinner className="h-6 w-6" />
    </div>
  ),
});

interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink";
  size: number;
  modified: string;
  permissions: string;
}

interface FileManagerProps {
  containerId: string;
  isRunning: boolean;
  onNavigateToTerminal?: (path: string) => void;
  /** The user's home directory path (e.g., /home/sandbox) */
  homePath?: string;
  /** Current path (controlled) */
  currentPath?: string;
  /** Callback when path changes */
  onPathChange?: (path: string) => void;
}

const DEFAULT_HOME = "/home/sandbox";
const SYSTEM_ROOT = "/";

// File icon based on extension
function getFileIcon(filename: string, type: string) {
  if (type === "directory") return Folder;
  if (type === "symlink") return File;

  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const codeExtensions = ["js", "ts", "jsx", "tsx", "py", "java", "go", "rs", "c", "cpp", "h", "rb", "php", "sh", "bash"];
  const textExtensions = ["txt", "md", "log", "env"];
  const jsonExtensions = ["json", "yaml", "yml", "toml", "xml"];
  const imageExtensions = ["png", "jpg", "jpeg", "gif", "svg", "webp", "ico"];
  const archiveExtensions = ["zip", "tar", "gz", "rar", "7z"];
  const styleExtensions = ["css", "scss", "sass", "less"];

  if (codeExtensions.includes(ext)) return FileCode;
  if (jsonExtensions.includes(ext)) return FileJson;
  if (imageExtensions.includes(ext)) return FileImage;
  if (archiveExtensions.includes(ext)) return FileArchive;
  if (styleExtensions.includes(ext)) return FileType;
  if (textExtensions.includes(ext)) return FileText;
  return File;
}

// Get language for syntax highlighting
function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const langMap: Record<string, string> = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    py: "python",
    java: "java",
    go: "go",
    rs: "rust",
    c: "c",
    cpp: "cpp",
    h: "c",
    rb: "ruby",
    php: "php",
    sh: "bash",
    bash: "bash",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    html: "html",
    css: "css",
    scss: "scss",
    md: "markdown",
    txt: "plaintext",
    env: "properties",
    log: "plaintext",
    toml: "toml",
    sql: "sql",
    graphql: "graphql",
  };

  const lowerName = filename.toLowerCase();
  if (lowerName === "dockerfile") return "dockerfile";
  if (lowerName === "makefile") return "makefile";
  if (lowerName.endsWith(".gitignore")) return "gitignore";
  if (lowerName.endsWith(".env") || lowerName.startsWith(".env")) return "properties";

  return langMap[ext] || "plaintext";
}

// Get display language name
function getDisplayLanguage(filename: string): string {
  const lang = getLanguage(filename);
  const displayMap: Record<string, string> = {
    javascript: "JavaScript",
    jsx: "JSX",
    typescript: "TypeScript",
    tsx: "TSX",
    python: "Python",
    java: "Java",
    go: "Go",
    rust: "Rust",
    c: "C",
    cpp: "C++",
    ruby: "Ruby",
    php: "PHP",
    bash: "Bash",
    json: "JSON",
    yaml: "YAML",
    xml: "XML",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    markdown: "Markdown",
    plaintext: "Text",
    properties: "Properties",
    toml: "TOML",
    sql: "SQL",
    graphql: "GraphQL",
    dockerfile: "Dockerfile",
    makefile: "Makefile",
    gitignore: "Git Ignore",
  };
  return displayMap[lang] || "Text";
}

// Check if file is editable (text-based)
function isEditableFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const editableExtensions = [
    "txt", "md", "log", "env", "json", "yaml", "yml", "toml", "xml", "html", "css", "scss",
    "js", "ts", "jsx", "tsx", "py", "java", "go", "rs", "c", "cpp", "h", "rb", "php", "sh", "bash",
    "gitignore", "dockerignore", "editorconfig", "prettierrc", "eslintrc", "babelrc", "sql", "graphql",
  ];
  const editableNames = ["makefile", "dockerfile", "readme", "license", "changelog"];
  return editableExtensions.includes(ext) || editableNames.includes(filename.toLowerCase());
}

// Check if file is an image
function isImageFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const imageExtensions = ["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp"];
  return imageExtensions.includes(ext);
}

// Check if file is a PDF
function isPDFFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return ext === "pdf";
}

// Format file size
function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function FileManager({
  containerId,
  isRunning,
  onNavigateToTerminal,
  homePath = DEFAULT_HOME,
  currentPath: controlledPath,
  onPathChange,
}: FileManagerProps) {
  // Use controlled path if provided, otherwise use internal state
  const [internalPath, setInternalPath] = useState(homePath);
  const currentPath = controlledPath ?? internalPath;

  const setCurrentPath = (path: string) => {
    if (onPathChange) {
      onPathChange(path);
    } else {
      setInternalPath(path);
    }
  };

  const [rootMode, setRootMode] = useState<"home" | "system">("home");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // View mode and sorting
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortBy, setSortBy] = useState<"name" | "size" | "modified" | "type">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Multi-select for file browser
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  // Copied path state
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // Clipboard for cut/copy operations
  const [clipboard, setClipboard] = useState<{ files: FileEntry[]; operation: "copy" | "cut" } | null>(null);

  // File info panel
  const [infoFile, setInfoFile] = useState<FileEntry | null>(null);

  // Dialogs
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; file: FileEntry | null }>({
    open: false,
    file: null,
  });
  const [createDialog, setCreateDialog] = useState<{
    open: boolean;
    type: "file" | "directory";
    name: string;
  }>({ open: false, type: "file", name: "" });
  const [uploadDialog, setUploadDialog] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [uploadProgress, setUploadProgress] = useState({
    loaded: 0,
    total: 0,
    speed: 0,
    startTime: 0,
  });
  const [conflictingFiles, setConflictingFiles] = useState<string[]>([]);
  const uploadXhrRef = useRef<XMLHttpRequest | null>(null);
  const uploadToastIdRef = useRef<string | number | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);

  // Edit/View file state
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    file: FileEntry | null;
    content: string;
    loading: boolean;
    saving: boolean;
  }>({ open: false, file: null, content: "", loading: false, saving: false });

  // Editor settings
  const [editorSettings, setEditorSettings] = useState({
    wordWrap: true,
    fontSize: 14,
  });

  // Find/Replace state
  const [findReplace, setFindReplace] = useState({
    show: false,
    findText: "",
    replaceText: "",
    matchCount: 0,
  });

  // Rename state
  const [renameDialog, setRenameDialog] = useState<{
    open: boolean;
    file: FileEntry | null;
    newName: string;
  }>({ open: false, file: null, newName: "" });

  // Image viewer state (enhanced with rotation, flip, fullscreen)
  const [imageViewer, setImageViewer] = useState<{
    open: boolean;
    file: FileEntry | null;
    loading: boolean;
    imageUrl: string | null;
    error: string | null;
    zoom: number;
    rotation: number;
    flipH: boolean;
    flipV: boolean;
    isFullscreen: boolean;
  }>({ open: false, file: null, loading: false, imageUrl: null, error: null, zoom: 100, rotation: 0, flipH: false, flipV: false, isFullscreen: false });

  // PDF viewer state
  const [pdfViewer, setPdfViewer] = useState<{
    open: boolean;
    file: FileEntry | null;
    loading: boolean;
    pdfUrl: string | null;
    error: string | null;
  }>({ open: false, file: null, loading: false, pdfUrl: null, error: null });

  // Keyboard shortcuts help modal
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // All images in current folder for slideshow
  const [allImages, setAllImages] = useState<FileEntry[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isSlideshow, setIsSlideshow] = useState(false);
  const slideshowRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // File manager settings
  const [fmSettings, setFmSettings] = useState({
    showHiddenFiles: false,
    showExtensions: true,
  });

  // Drag state for file moving within file manager
  const [draggedFile, setDraggedFile] = useState<FileEntry | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);

  // Compress/Extract dialogs
  const [compressDialog, setCompressDialog] = useState<{
    open: boolean;
    files: FileEntry[];
    archiveName: string;
  }>({ open: false, files: [], archiveName: "" });
  const [extracting, setExtracting] = useState(false);

  // Drag and drop refs
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Fetch files
  const fetchFiles = useCallback(async () => {
    if (!isRunning) {
      setError("Container must be running to browse files");
      setFiles([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/sandbox/containers/${containerId}/files?path=${encodeURIComponent(currentPath)}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch files");
      }

      const data = await response.json();
      setFiles(data.files || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch files");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [containerId, currentPath, isRunning]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when not in a dialog
      if (editDialog.open || createDialog.open || renameDialog.open || uploadDialog) return;

      // Ctrl+C - Copy
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && !e.shiftKey) {
        if (selectedPaths.size > 0) {
          e.preventDefault();
          handleCopyFiles();
        }
      }
      // Ctrl+X - Cut
      if ((e.ctrlKey || e.metaKey) && e.key === "x") {
        if (selectedPaths.size > 0) {
          e.preventDefault();
          handleCutFiles();
        }
      }
      // Ctrl+V - Paste
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        if (clipboard && clipboard.files.length > 0) {
          e.preventDefault();
          handlePaste();
        }
      }
      // Delete key
      if (e.key === "Delete" && selectedPaths.size > 0) {
        e.preventDefault();
        handleDeleteSelected();
      }
      // F2 - Rename (single selection)
      if (e.key === "F2" && selectedPaths.size === 1) {
        e.preventDefault();
        const selectedFile = files.find(f => selectedPaths.has(f.path));
        if (selectedFile) {
          setRenameDialog({ open: true, file: selectedFile, newName: selectedFile.name });
        }
      }
      // Ctrl+A - Select all
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        selectAllFiles();
      }
      // Escape - Clear selection
      if (e.key === "Escape") {
        clearSelection();
      }
      // ? or F1 - Show keyboard shortcuts help
      if (e.key === "?" || e.key === "F1") {
        e.preventDefault();
        setShowShortcutsHelp(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPaths, clipboard, files, editDialog.open, createDialog.open, renameDialog.open, uploadDialog]);

  // Navigate to directory
  const navigateTo = (path: string) => {
    setCurrentPath(path);
    setSelectedPaths(new Set());
  };

  // Navigate up
  const navigateUp = () => {
    const rootPath = rootMode === "home" ? homePath : SYSTEM_ROOT;
    if (currentPath === rootPath) return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    const newPath = "/" + parts.join("/");
    setCurrentPath(newPath || rootPath);
    setSelectedPaths(new Set());
  };

  // Toggle root mode
  const toggleRootMode = () => {
    const newMode = rootMode === "home" ? "system" : "home";
    setRootMode(newMode);
    setCurrentPath(newMode === "home" ? homePath : SYSTEM_ROOT);
    setSelectedPaths(new Set());
  };

  // Open path in terminal
  const handleOpenInTerminal = (path: string) => {
    if (onNavigateToTerminal) {
      onNavigateToTerminal(path);
      toast.success(`Navigate to: ${path}`);
    } else {
      // Dispatch event for terminal to pick up
      window.dispatchEvent(new CustomEvent("terminal-paste", { detail: `cd ${path}\n` }));
      toast.success(`Sent to terminal: cd ${path}`);
    }
  };

  // Delete file/directory
  const handleDelete = async () => {
    if (!deleteDialog.file) return;

    try {
      const response = await fetch(
        `/api/sandbox/containers/${containerId}/files?path=${encodeURIComponent(
          deleteDialog.file.path
        )}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete");
      }

      toast.success(`Deleted ${deleteDialog.file.name}`);
      fetchFiles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleteDialog({ open: false, file: null });
    }
  };

  // Create file/directory
  const handleCreate = async () => {
    if (!createDialog.name.trim()) return;

    try {
      const path = `${currentPath}/${createDialog.name}`.replace("//", "/");
      const response = await fetch(`/api/sandbox/containers/${containerId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path,
          type: createDialog.type,
          content: createDialog.type === "file" ? "" : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create");
      }

      toast.success(`Created ${createDialog.name}`);
      fetchFiles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreateDialog({ open: false, type: "file", name: "" });
    }
  };

  // Check for existing files
  const checkForConflicts = () => {
    const existingFileNames = files
      .filter(f => f.type === "file")
      .map(f => f.name);

    const conflicts = selectedFiles
      .map(f => f.name)
      .filter(name => existingFileNames.includes(name));

    if (conflicts.length > 0) {
      setConflictingFiles(conflicts);
      setUploadDialog(false); // Close upload dialog before showing conflict dialog
      setShowConflictDialog(true);
      return true;
    }

    return false;
  };

  // Cancel upload handler
  const handleCancelUpload = () => {
    if (uploadXhrRef.current) {
      uploadXhrRef.current.abort();
      uploadXhrRef.current = null;
    }
    if (uploadToastIdRef.current) {
      toast.dismiss(uploadToastIdRef.current);
      uploadToastIdRef.current = null;
    }
    setUploading(false);
    setSelectedFiles([]);
    setUploadProgress({ loaded: 0, total: 0, speed: 0, startTime: 0 });
    toast.info("Upload cancelled");
  };

  // Upload files with progress tracking via sonner toast
  const handleUpload = async (skipConflictCheck = false) => {
    if (selectedFiles.length === 0) return;

    // Check for conflicts unless we're skipping (user confirmed overwrite)
    if (!skipConflictCheck && checkForConflicts()) {
      return;
    }

    // Close dialog and start upload with toast
    setUploadDialog(false);
    setUploading(true);
    const startTime = Date.now();
    const fileCount = selectedFiles.length;
    const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

    // Show initial toast with cancel action
    const toastId = toast.loading(
      `Uploading ${fileCount} file(s) — 0% of ${formatSize(totalSize)}`,
      {
        duration: Infinity,
        action: {
          label: "Cancel",
          onClick: handleCancelUpload,
        },
      }
    );
    uploadToastIdRef.current = toastId;

    try {
      const formData = new FormData();
      formData.append("path", currentPath);

      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      // Use XMLHttpRequest to track upload progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        uploadXhrRef.current = xhr;

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const elapsed = (Date.now() - startTime) / 1000; // seconds
            const speed = e.loaded / elapsed; // bytes per second
            const percent = Math.round((e.loaded / e.total) * 100);

            setUploadProgress({
              loaded: e.loaded,
              total: e.total,
              speed,
              startTime,
            });

            // Update toast with progress
            toast.loading(
              `Uploading ${fileCount} file(s) — ${percent}% (${formatSize(e.loaded)} / ${formatSize(e.total)}) at ${formatSize(speed)}/s`,
              {
                id: toastId,
                duration: Infinity,
                action: {
                  label: "Cancel",
                  onClick: handleCancelUpload,
                },
              }
            );
          }
        });

        xhr.addEventListener("load", () => {
          uploadXhrRef.current = null;
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              toast.success(`Uploaded ${data.count} file(s) successfully`, { id: toastId });
              uploadToastIdRef.current = null;
              fetchFiles();
              resolve();
            } catch (err) {
              reject(new Error("Failed to parse response"));
            }
          } else {
            try {
              const data = JSON.parse(xhr.responseText);
              reject(new Error(data.error || "Failed to upload"));
            } catch {
              reject(new Error("Failed to upload"));
            }
          }
        });

        xhr.addEventListener("error", () => {
          uploadXhrRef.current = null;
          reject(new Error("Upload failed"));
        });

        xhr.addEventListener("abort", () => {
          uploadXhrRef.current = null;
          // Don't reject on abort - it's handled by handleCancelUpload
        });

        xhr.open("POST", `/api/sandbox/containers/${containerId}/files/upload`);
        xhr.send(formData);
      });
    } catch (err) {
      if (uploadToastIdRef.current) {
        toast.error(err instanceof Error ? err.message : "Failed to upload", { id: uploadToastIdRef.current });
        uploadToastIdRef.current = null;
      }
    } finally {
      setUploading(false);
      setSelectedFiles([]);
      setUploadProgress({ loaded: 0, total: 0, speed: 0, startTime: 0 });
    }
  };

  // Download file
  const handleDownload = async (file: FileEntry) => {
    try {
      const response = await fetch(
        `/api/sandbox/containers/${containerId}/files/download?path=${encodeURIComponent(
          file.path
        )}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to download");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Downloaded ${file.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download");
    }
  };

  // Open file for editing/viewing
  const handleOpenFile = async (file: FileEntry) => {
    if (!isEditableFile(file.name)) {
      toast.error("This file type cannot be edited");
      return;
    }

    setEditDialog({ open: true, file, content: "", loading: true, saving: false });

    try {
      const response = await fetch(
        `/api/sandbox/containers/${containerId}/files/download?path=${encodeURIComponent(file.path)}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load file");
      }

      const text = await response.text();
      setEditDialog((prev) => ({ ...prev, content: text, loading: false }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load file");
      setEditDialog({ open: false, file: null, content: "", loading: false, saving: false });
    }
  };

  // Open image for viewing
  const handleViewImage = async (file: FileEntry) => {
    if (!isImageFile(file.name)) {
      toast.error("This file is not an image");
      return;
    }

    // Get all images in current folder for slideshow
    const images = files.filter(f => f.type === "file" && isImageFile(f.name));
    const index = images.findIndex(f => f.path === file.path);
    setAllImages(images);
    setCurrentImageIndex(index >= 0 ? index : 0);

    setImageViewer({ open: true, file, loading: true, imageUrl: null, error: null, zoom: 100, rotation: 0, flipH: false, flipV: false, isFullscreen: false });

    try {
      const response = await fetch(
        `/api/sandbox/containers/${containerId}/files/download?path=${encodeURIComponent(file.path)}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load image");
      }

      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      setImageViewer((prev) => ({ ...prev, imageUrl, loading: false }));
    } catch (err) {
      setImageViewer((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load image",
      }));
    }
  };

  // Open PDF for viewing
  const handleViewPDF = async (file: FileEntry) => {
    if (!isPDFFile(file.name)) {
      toast.error("This file is not a PDF");
      return;
    }

    setPdfViewer({ open: true, file, loading: true, pdfUrl: null, error: null });

    try {
      const response = await fetch(
        `/api/sandbox/containers/${containerId}/files/download?path=${encodeURIComponent(file.path)}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to load PDF");
      }

      const blob = await response.blob();
      const pdfUrl = URL.createObjectURL(blob);
      setPdfViewer((prev) => ({ ...prev, pdfUrl, loading: false }));
    } catch (err) {
      setPdfViewer((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load PDF",
      }));
    }
  };

  // Navigate to next/previous image
  const navigateImage = async (direction: "next" | "prev") => {
    if (allImages.length <= 1) return;

    const newIndex = direction === "next"
      ? (currentImageIndex + 1) % allImages.length
      : (currentImageIndex - 1 + allImages.length) % allImages.length;

    setCurrentImageIndex(newIndex);
    const newFile = allImages[newIndex];

    // Clean up old URL
    if (imageViewer.imageUrl) {
      URL.revokeObjectURL(imageViewer.imageUrl);
    }

    setImageViewer(prev => ({ ...prev, file: newFile, loading: true, imageUrl: null, zoom: 100, rotation: 0, flipH: false, flipV: false }));

    try {
      const response = await fetch(
        `/api/sandbox/containers/${containerId}/files/download?path=${encodeURIComponent(newFile.path)}`
      );

      if (!response.ok) throw new Error("Failed to load image");

      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      setImageViewer(prev => ({ ...prev, imageUrl, loading: false }));
    } catch {
      setImageViewer(prev => ({ ...prev, loading: false, error: "Failed to load image" }));
    }
  };

  // Toggle slideshow
  const toggleSlideshow = () => {
    if (isSlideshow) {
      if (slideshowRef.current) {
        clearInterval(slideshowRef.current);
        slideshowRef.current = null;
      }
      setIsSlideshow(false);
    } else {
      setIsSlideshow(true);
      slideshowRef.current = setInterval(() => {
        navigateImage("next");
      }, 3000);
    }
  };

  // Stop slideshow on viewer close
  useEffect(() => {
    if (!imageViewer.open && slideshowRef.current) {
      clearInterval(slideshowRef.current);
      slideshowRef.current = null;
      setIsSlideshow(false);
    }
  }, [imageViewer.open]);

  // Cleanup image URL when viewer closes
  const closeImageViewer = () => {
    if (imageViewer.imageUrl) {
      URL.revokeObjectURL(imageViewer.imageUrl);
    }
    if (slideshowRef.current) {
      clearInterval(slideshowRef.current);
      slideshowRef.current = null;
    }
    setIsSlideshow(false);
    setImageViewer({ open: false, file: null, loading: false, imageUrl: null, error: null, zoom: 100, rotation: 0, flipH: false, flipV: false, isFullscreen: false });
  };

  // Cleanup PDF URL when viewer closes
  const closePdfViewer = () => {
    if (pdfViewer.pdfUrl) {
      URL.revokeObjectURL(pdfViewer.pdfUrl);
    }
    setPdfViewer({ open: false, file: null, loading: false, pdfUrl: null, error: null });
  };

  // Save edited file
  const handleSaveFile = async () => {
    if (!editDialog.file) return;

    setEditDialog((prev) => ({ ...prev, saving: true }));

    try {
      const response = await fetch(`/api/sandbox/containers/${containerId}/files`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: editDialog.file.path,
          content: editDialog.content,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save file");
      }

      toast.success(`Saved ${editDialog.file.name}`);
      fetchFiles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save file");
    } finally {
      setEditDialog((prev) => ({ ...prev, saving: false }));
    }
  };

  // Find text in editor
  const handleFind = (text: string) => {
    if (!text) {
      setFindReplace((prev) => ({ ...prev, matchCount: 0 }));
      return;
    }
    const regex = new RegExp(text, "gi");
    const matches = editDialog.content.match(regex);
    setFindReplace((prev) => ({ ...prev, matchCount: matches?.length || 0 }));
  };

  // Replace text in editor
  const handleReplace = () => {
    if (!findReplace.findText) return;
    const newContent = editDialog.content.replace(findReplace.findText, findReplace.replaceText);
    setEditDialog((prev) => ({ ...prev, content: newContent }));
    handleFind(findReplace.findText);
  };

  // Replace all text in editor
  const handleReplaceAll = () => {
    if (!findReplace.findText) return;
    const regex = new RegExp(findReplace.findText, "g");
    const newContent = editDialog.content.replace(regex, findReplace.replaceText);
    setEditDialog((prev) => ({ ...prev, content: newContent }));
    setFindReplace((prev) => ({ ...prev, matchCount: 0 }));
    toast.success("All replaced");
  };

  // Count lines in content
  const getLineCount = (content: string): number => {
    return content.split("\n").length;
  };

  // Rename file/directory
  const handleRename = async () => {
    if (!renameDialog.file || !renameDialog.newName.trim()) return;

    const oldPath = renameDialog.file.path;
    const newPath = oldPath.replace(/\/[^/]+$/, `/${renameDialog.newName}`);

    try {
      const response = await fetch(`/api/sandbox/containers/${containerId}/files`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPath, newPath }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to rename");
      }

      toast.success(`Renamed to ${renameDialog.newName}`);
      fetchFiles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rename");
    } finally {
      setRenameDialog({ open: false, file: null, newName: "" });
    }
  };

  // Drag and drop handlers for external file upload - using counter to prevent flicker
  const handleDragEnter = (e: React.DragEvent) => {
    // Ignore internal file manager drags
    if (e.dataTransfer.types.includes("application/x-file-manager")) return;
    e.preventDefault();
    e.stopPropagation();
    if (isRunning) {
      setDragCounter((prev) => prev + 1);
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Ignore internal file manager drags
    if (e.dataTransfer.types.includes("application/x-file-manager")) return;
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => {
      const newCount = prev - 1;
      if (newCount === 0) {
        setIsDragging(false);
      }
      return newCount;
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    // Ignore internal file manager drags
    if (e.dataTransfer.types.includes("application/x-file-manager")) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    // Ignore internal file manager drags - they are handled by handleFileDrop
    if (e.dataTransfer.types.includes("application/x-file-manager")) {
      setIsDragging(false);
      setDragCounter(0);
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    if (!isRunning) return;

    // Handle external files and folders (upload)
    const items = Array.from(e.dataTransfer.items);
    const droppedFiles: File[] = [];

    // Process all items (files and folders)
    for (const item of items) {
      if (item.kind === "file") {
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
          await processEntry(entry, droppedFiles);
        } else {
          const file = item.getAsFile();
          if (file) droppedFiles.push(file);
        }
      }
    }

    if (droppedFiles.length === 0) return;

    // Append dropped files to existing selection (avoid duplicates)
    setSelectedFiles(prev => {
      const existingNames = new Set(prev.map(f => f.name + f.size));
      const uniqueNewFiles = droppedFiles.filter(f => !existingNames.has(f.name + f.size));
      return [...prev, ...uniqueNewFiles];
    });
    setUploadDialog(true);
  };

  // Helper to process file entries (including folders)
  const processEntry = async (entry: any, files: File[]): Promise<void> => {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file: File) => {
          files.push(file);
          resolve();
        });
      });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      return new Promise((resolve) => {
        reader.readEntries(async (entries: any[]) => {
          for (const childEntry of entries) {
            await processEntry(childEntry, files);
          }
          resolve();
        });
      });
    }
  };

  // Copy path to clipboard
  const handleCopyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedPath(path);
      toast.success("Path copied");
      setTimeout(() => setCopiedPath(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  // Copy files to clipboard
  const handleCopyFiles = () => {
    const filesToCopy = files.filter(f => selectedPaths.has(f.path));
    if (filesToCopy.length === 0) {
      toast.error("No files selected to copy");
      return;
    }
    setClipboard({ files: [...filesToCopy], operation: "copy" });
    toast.success(`Copied ${filesToCopy.length} item(s) - navigate to destination and paste`);
  };

  // Cut files to clipboard
  const handleCutFiles = () => {
    const filesToCut = files.filter(f => selectedPaths.has(f.path));
    if (filesToCut.length === 0) {
      toast.error("No files selected to cut");
      return;
    }
    setClipboard({ files: [...filesToCut], operation: "cut" });
    toast.success(`Cut ${filesToCut.length} item(s) - navigate to destination and paste`);
  };

  // Paste files from clipboard
  const handlePaste = async () => {
    if (!clipboard || clipboard.files.length === 0) {
      toast.error("Nothing to paste - clipboard is empty");
      return;
    }

    if (!isRunning) {
      toast.error("Container must be running to paste files");
      return;
    }

    const sourcePaths = clipboard.files.map(f => f.path);
    const apiOperation = clipboard.operation === "cut" ? "move" : "copy";

    // Don't paste to the same location for move operations
    if (clipboard.operation === "cut") {
      const sourceDir = clipboard.files[0].path.substring(0, clipboard.files[0].path.lastIndexOf("/")) || "/";
      if (sourceDir === currentPath) {
        toast.error("Cannot move files to the same location");
        return;
      }
    }

    const toastId = toast.loading(`${clipboard.operation === "copy" ? "Copying" : "Moving"} ${clipboard.files.length} item(s)...`);

    try {
      const response = await fetch(`/api/sandbox/containers/${containerId}/files/copy-move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePaths,
          targetPath: currentPath,
          operation: apiOperation,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.dismiss(toastId);
        toast.error(data.error || "Failed to paste");
        return;
      }

      if (data.success) {
        toast.dismiss(toastId);
        toast.success(`${clipboard.operation === "copy" ? "Copied" : "Moved"} ${clipboard.files.length} item(s)`);
        if (clipboard.operation === "cut") {
          setClipboard(null);
        }
        fetchFiles();
      } else {
        toast.dismiss(toastId);
        const failedCount = data.results?.filter((r: { success: boolean }) => !r.success).length || 0;
        if (failedCount > 0) {
          toast.error(`Failed to paste ${failedCount} item(s)`);
        } else {
          toast.error("Paste operation failed");
        }
        fetchFiles(); // Refresh anyway to show partial results
      }
    } catch (err) {
      toast.dismiss(toastId);
      toast.error(err instanceof Error ? err.message : "Failed to paste");
    }
  };

  // Toggle file selection
  const toggleFileSelection = (path: string) => {
    const newSelection = new Set(selectedPaths);
    if (newSelection.has(path)) {
      newSelection.delete(path);
    } else {
      newSelection.add(path);
    }
    setSelectedPaths(newSelection);
  };

  // Select all files
  const selectAllFiles = () => {
    const allPaths = new Set(files.map((f) => f.path));
    setSelectedPaths(allPaths);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedPaths(new Set());
  };

  // Delete selected files
  const handleDeleteSelected = async () => {
    if (selectedPaths.size === 0) return;

    for (const path of selectedPaths) {
      try {
        await fetch(
          `/api/sandbox/containers/${containerId}/files?path=${encodeURIComponent(path)}`,
          { method: "DELETE" }
        );
      } catch {
        toast.error(`Failed to delete ${path}`);
      }
    }
    toast.success(`Deleted ${selectedPaths.size} item(s)`);
    clearSelection();
    fetchFiles();
  };

  // Sort files
  const sortFiles = (filesToSort: FileEntry[]) => {
    return [...filesToSort].sort((a, b) => {
      if (a.type === "directory" && b.type !== "directory") return -1;
      if (a.type !== "directory" && b.type === "directory") return 1;

      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "size":
          comparison = a.size - b.size;
          break;
        case "modified":
          comparison = new Date(a.modified).getTime() - new Date(b.modified).getTime();
          break;
        case "type":
          const extA = a.name.split(".").pop() || "";
          const extB = b.name.split(".").pop() || "";
          comparison = extA.localeCompare(extB);
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  };

  // Toggle sort
  const toggleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(newSortBy);
      setSortOrder("asc");
    }
  };

  // Filter files based on search and settings
  const filteredFiles = files.filter((f) => {
    // Filter hidden files
    if (!fmSettings.showHiddenFiles && f.name.startsWith(".")) {
      return false;
    }
    // Filter by search query
    if (searchQuery && !f.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Apply sorting
  const sortedFiles = sortFiles(filteredFiles);

  // Get display name (with or without extension)
  const getDisplayName = (filename: string, type: string) => {
    if (type === "directory" || fmSettings.showExtensions) return filename;
    const lastDot = filename.lastIndexOf(".");
    if (lastDot === -1 || lastDot === 0) return filename;
    return filename.substring(0, lastDot);
  };

  // Check if file is an archive
  const isArchiveFile = (filename: string): boolean => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    return ["zip", "tar", "gz", "tgz", "tar.gz", "7z", "rar"].includes(ext);
  };

  // Compress files
  const handleCompress = async () => {
    if (compressDialog.files.length === 0 || !compressDialog.archiveName.trim()) return;

    const loadingToast = toast.loading("Compressing files...");
    try {
      const sourcePaths = compressDialog.files.map(f => f.path);

      const response = await fetch(`/api/sandbox/containers/${containerId}/files/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "compress",
          sourcePaths,
          archiveName: compressDialog.archiveName,
          destinationPath: currentPath,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to compress files");
      }

      toast.dismiss(loadingToast);
      toast.success(data.message || `Created ${compressDialog.archiveName}.zip`);
      fetchFiles();
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error(err instanceof Error ? err.message : "Failed to compress");
    } finally {
      setCompressDialog({ open: false, files: [], archiveName: "" });
    }
  };

  // Extract archive
  const handleExtract = async (file: FileEntry) => {
    if (!isArchiveFile(file.name)) return;

    setExtracting(true);
    const loadingToast = toast.loading(`Extracting ${file.name}...`);
    try {
      const response = await fetch(`/api/sandbox/containers/${containerId}/files/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extract",
          archivePath: file.path,
          destinationPath: currentPath,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to extract archive");
      }

      toast.dismiss(loadingToast);
      toast.success(data.message || `Extracted ${file.name}`);
      fetchFiles();
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error(err instanceof Error ? err.message : "Failed to extract");
    } finally {
      setExtracting(false);
    }
  };

  // Handle internal drag start
  const handleFileDragStart = (e: React.DragEvent, file: FileEntry) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-file-manager", JSON.stringify(file));
    e.dataTransfer.setData("text/plain", file.path);
    setDraggedFile(file);
  };

  // Handle internal drag over folder
  const handleFolderDragOver = (e: React.DragEvent, folder: FileEntry) => {
    // Check if this is an internal drag (not external file upload)
    if (!e.dataTransfer.types.includes("application/x-file-manager")) return;
    if (!draggedFile || draggedFile.path === folder.path) return;
    if (folder.type !== "directory") return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDropTargetPath(folder.path);
  };

  // Handle internal drag leave
  const handleFolderDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetPath(null);
  };

  // Handle internal drop on folder
  const handleFileDrop = async (e: React.DragEvent, targetFolder: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetPath(null);

    // Check if this is an internal drag
    if (!e.dataTransfer.types.includes("application/x-file-manager")) {
      return;
    }

    const fileData = e.dataTransfer.getData("application/x-file-manager");
    if (!fileData) {
      setDraggedFile(null);
      return;
    }

    let sourceFile: FileEntry;
    try {
      sourceFile = JSON.parse(fileData);
    } catch {
      setDraggedFile(null);
      return;
    }

    if (sourceFile.path === targetFolder.path) {
      setDraggedFile(null);
      return;
    }

    // Don't allow dropping a folder into itself
    if (targetFolder.path.startsWith(sourceFile.path + "/")) {
      toast.error("Cannot move folder into itself");
      setDraggedFile(null);
      return;
    }

    // Don't allow dropping into the same parent folder
    const sourceParent = sourceFile.path.substring(0, sourceFile.path.lastIndexOf("/")) || "/";
    if (sourceParent === targetFolder.path) {
      toast.error("File is already in this folder");
      setDraggedFile(null);
      return;
    }

    try {
      const response = await fetch(`/api/sandbox/containers/${containerId}/files/copy-move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePaths: [sourceFile.path],
          targetPath: targetFolder.path,
          operation: "move",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to move");
      }

      toast.success(`Moved ${sourceFile.name} to ${targetFolder.name}`);
      fetchFiles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to move");
    } finally {
      setDraggedFile(null);
    }
  };

  // Handle drag end
  const handleFileDragEnd = () => {
    setDraggedFile(null);
    setDropTargetPath(null);
  };

  // Breadcrumb parts
  const pathParts = currentPath.split("/").filter(Boolean);

  // Prevent browser context menu on the file manager
  const handleContextMenu = (e: React.MouseEvent) => {
    // Only prevent default if we're in the file manager area
    // The Radix ContextMenu will handle showing our custom menu
    e.preventDefault();
  };

  return (
    <Card
      ref={dropZoneRef}
      className={`h-full flex flex-col transition-colors border-0 shadow-none ${isDragging ? "border-primary bg-primary/5" : ""
        }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onContextMenu={handleContextMenu}
    >
      {/* Compact Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b shrink-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Folder className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-medium truncate">File Manager</span>
          {selectedPaths.size > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
              {selectedPaths.size}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {selectedPaths.size > 0 && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopyFiles}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Copy (Ctrl+C)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCutFiles}>
                    <Scissors className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Cut (Ctrl+X)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={handleDeleteSelected}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Delete (Del)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearSelection}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Clear selection (Esc)</TooltipContent>
              </Tooltip>
              <Separator orientation="vertical" className="h-4 mx-0.5" />
            </>
          )}

          {clipboard && clipboard.files.length > 0 && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={handlePaste}
                    disabled={!isRunning}
                  >
                    <Clipboard className="h-3.5 w-3.5" />
                    Paste ({clipboard.files.length})
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {clipboard.operation === "copy" ? "Copy" : "Move"} {clipboard.files.length} item(s) here (Ctrl+V)
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setClipboard(null)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Clear clipboard</TooltipContent>
              </Tooltip>
              <Separator orientation="vertical" className="h-4 mx-0.5" />
            </>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowSearch(!showSearch)}
                disabled={!isRunning}
              >
                <Search className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Search (Ctrl+F)</TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!isRunning}>
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">Sort options</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => toggleSort("name")}>
                <FileIcon className="h-4 w-4 mr-2" />
                Name {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleSort("size")}>
                <HardDrive className="h-4 w-4 mr-2" />
                Size {sortBy === "size" && (sortOrder === "asc" ? "↑" : "↓")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleSort("modified")}>
                <Clock className="h-4 w-4 mr-2" />
                Date {sortBy === "modified" && (sortOrder === "asc" ? "↑" : "↓")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleSort("type")}>
                <FileType className="h-4 w-4 mr-2" />
                Type {sortBy === "type" && (sortOrder === "asc" ? "↑" : "↓")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
                disabled={!isRunning}
              >
                {viewMode === "list" ? <LayoutGrid className="h-3.5 w-3.5" /> : <LayoutList className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{viewMode === "list" ? "Grid view" : "List view"}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={rootMode === "system" ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                onClick={toggleRootMode}
                disabled={!isRunning}
              >
                {rootMode === "home" ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{rootMode === "home" ? "Show full filesystem" : "Show home only"}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={fetchFiles}
                disabled={!isRunning || loading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Refresh (F5)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowShortcutsHelp(true)}
                disabled={!isRunning}
              >
                <Keyboard className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Keyboard shortcuts (?)</TooltipContent>
          </Tooltip>

          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!isRunning}>
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">Settings</TooltipContent>
            </Tooltip>
            <PopoverContent align="end" className="w-56 p-3">
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Display Settings</h4>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-hidden" className="text-xs flex items-center gap-2">
                    <EyeOff className="h-3.5 w-3.5" />
                    Show hidden files
                  </Label>
                  <Switch
                    id="show-hidden"
                    checked={fmSettings.showHiddenFiles}
                    onCheckedChange={(checked) => setFmSettings(s => ({ ...s, showHiddenFiles: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-ext" className="text-xs flex items-center gap-2">
                    <FileType className="h-3.5 w-3.5" />
                    Show extensions
                  </Label>
                  <Switch
                    id="show-ext"
                    checked={fmSettings.showExtensions}
                    onCheckedChange={(checked) => setFmSettings(s => ({ ...s, showExtensions: checked }))}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" size="sm" className="h-7 px-2 text-xs" disabled={!isRunning}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                New
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setCreateDialog({ open: true, type: "file", name: "" })}>
                <FilePlus className="h-4 w-4 mr-2" />
                New File
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCreateDialog({ open: true, type: "directory", name: "" })}>
                <FolderPlus className="h-4 w-4 mr-2" />
                New Folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setUploadDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Files
              </DropdownMenuItem>
              {clipboard && clipboard.files.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handlePaste}>
                    <Clipboard className="h-4 w-4 mr-2" />
                    Paste ({clipboard.files.length})
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={selectAllFiles}>
                <Files className="h-4 w-4 mr-2" />
                Select All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-0.5 px-2 py-1 text-xs text-muted-foreground border-b overflow-x-auto">
        <button
          onClick={() => navigateTo(rootMode === "home" ? homePath : SYSTEM_ROOT)}
          className="p-0.5 hover:bg-muted rounded shrink-0 flex items-center gap-1"
          title={rootMode === "home" ? homePath : "/"}
        >
          <Home className="h-3.5 w-3.5" />
          {rootMode === "system" && <span className="text-[10px]">/</span>}
        </button>
        {pathParts.map((part, index) => (
          <div key={index} className="flex items-center shrink-0">
            <ChevronRight className="h-3 w-3" />
            <button
              onClick={() => navigateTo("/" + pathParts.slice(0, index + 1).join("/"))}
              className="px-1 hover:bg-muted rounded truncate max-w-[80px]"
            >
              {part}
            </button>
          </div>
        ))}
      </div>

      {/* Search input */}
      {showSearch && (
        <div className="flex items-center gap-1 px-2 py-1 border-b">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 text-xs border-0 focus-visible:ring-0 px-1"
            autoFocus
          />
          {searchQuery && (
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setSearchQuery("")}>
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}

      {/* Status bar */}
      {isRunning && !loading && !error && (
        <div className="flex items-center justify-between px-2 py-0.5 text-[10px] text-muted-foreground border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <span>{sortedFiles.length} items{searchQuery && " (filtered)"}</span>
            {rootMode === "system" && (
              <Badge variant="outline" className="text-[9px] h-4 px-1 bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                Full Access
              </Badge>
            )}
          </div>
          <span className="font-mono truncate max-w-[150px]">{currentPath}</span>
        </div>
      )}

      <CardContent className="flex-1 min-h-0 p-0 flex flex-col">
        {!isRunning ? (
          <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground p-4">
            <AlertTriangle className="h-6 w-6 mb-2" />
            <p className="text-xs text-center">Container must be running</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center flex-1 text-destructive p-4">
            <AlertTriangle className="h-6 w-6 mb-2" />
            <p className="text-xs text-center mb-2">{error}</p>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={fetchFiles}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2">
            <Spinner className="h-6 w-6 text-primary" />
            <p className="text-xs text-muted-foreground">Loading...</p>
          </div>
        ) : (
          <ScrollArea className="h-full flex-1">
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div
                  className="p-1 min-h-full"
                  style={{ minHeight: "100%" }}
                  onClick={(e) => {
                    // Click on empty space clears selection
                    if (e.target === e.currentTarget) {
                      clearSelection();
                    }
                  }}
                >
                  {currentPath !== (rootMode === "home" ? homePath : SYSTEM_ROOT) && (
                    <button
                      onClick={navigateUp}
                      className="flex items-center gap-2 w-full p-1.5 rounded hover:bg-muted text-left text-xs"
                    >
                      <FolderUp className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">..</span>
                    </button>
                  )}

                  {isDragging && (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg z-10">
                      <div className="text-center">
                        <Upload className="h-6 w-6 mx-auto mb-1 text-primary" />
                        <p className="text-xs font-medium text-primary">Drop files or folders here</p>
                      </div>
                    </div>
                  )}

              {sortedFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  {searchQuery ? (
                    <>
                      <Search className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-xs">No files match</p>
                      <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs" onClick={() => setSearchQuery("")}>
                        Clear search
                      </Button>
                    </>
                  ) : (
                    <>
                      <Folder className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-xs">Empty directory</p>
                      <div className="flex gap-1 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setCreateDialog({ open: true, type: "file", name: "" })}
                        >
                          <FilePlus className="h-3 w-3 mr-1" />
                          File
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setUploadDialog(true)}>
                          <Upload className="h-3 w-3 mr-1" />
                          Upload
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : viewMode === "list" ? (
                sortedFiles.map((file) => {
                  const Icon = getFileIcon(file.name, file.type);
                  const canEdit = file.type === "file" && isEditableFile(file.name);
                  const canViewImage = file.type === "file" && isImageFile(file.name);
                  const canViewPDF = file.type === "file" && isPDFFile(file.name);
                  const canExtract = file.type === "file" && isArchiveFile(file.name);
                  const isSelected = selectedPaths.has(file.path);
                  const isInClipboard = clipboard?.files.some(f => f.path === file.path);
                  const isDropTarget = dropTargetPath === file.path;
                  const isDragged = draggedFile?.path === file.path;
                  return (
                    <ContextMenu key={file.path}>
                      <ContextMenuTrigger asChild>
                        <div
                          draggable
                          onDragStart={(e) => handleFileDragStart(e, file)}
                          onDragEnd={handleFileDragEnd}
                          onDragOver={(e) => file.type === "directory" && handleFolderDragOver(e, file)}
                          onDragLeave={handleFolderDragLeave}
                          onDrop={(e) => file.type === "directory" && handleFileDrop(e, file)}
                          onClick={(e) => {
                            if (e.ctrlKey || e.metaKey) {
                              toggleFileSelection(file.path);
                            } else if (e.shiftKey && selectedPaths.size > 0) {
                              // Shift+click for range selection
                              const allPaths = sortedFiles.map(f => f.path);
                              const lastSelected = Array.from(selectedPaths).pop();
                              const lastIdx = allPaths.indexOf(lastSelected || "");
                              const currentIdx = allPaths.indexOf(file.path);
                              const [start, end] = lastIdx < currentIdx ? [lastIdx, currentIdx] : [currentIdx, lastIdx];
                              const range = new Set(allPaths.slice(start, end + 1));
                              setSelectedPaths(range);
                            } else {
                              setSelectedPaths(new Set([file.path]));
                            }
                          }}
                          onDoubleClick={() => {
                            if (file.type === "directory") navigateTo(file.path);
                            else if (canEdit) handleOpenFile(file);
                            else if (canViewImage) handleViewImage(file);
                            else if (canViewPDF) handleViewPDF(file);
                          }}
                          className={`flex items-center gap-2 w-full px-2 py-1.5 rounded cursor-pointer select-none group text-xs transition-colors ${
                            isSelected ? "bg-primary/15 hover:bg-primary/20" : "hover:bg-muted"
                          } ${isInClipboard && clipboard?.operation === "cut" ? "opacity-50" : ""} ${
                            isDropTarget ? "bg-primary/25 ring-2 ring-primary" : ""
                          } ${isDragged ? "opacity-40" : ""}`}
                        >
                          <Icon className={`h-4 w-4 shrink-0 ${
                            file.type === "directory" ? "text-primary" :
                            canViewImage ? "text-purple-500" :
                            canViewPDF ? "text-red-500" :
                            canExtract ? "text-amber-500" :
                            "text-muted-foreground"
                          }`} />
                          <span className="truncate flex-1">{getDisplayName(file.name, file.type)}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                            {formatSize(file.size)}
                          </span>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canEdit && (
                                <DropdownMenuItem onClick={() => handleOpenFile(file)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              {canViewImage && (
                                <DropdownMenuItem onClick={() => handleViewImage(file)}>
                                  <FileImage className="h-4 w-4 mr-2" />
                                  View Image
                                </DropdownMenuItem>
                              )}
                              {canViewPDF && (
                                <DropdownMenuItem onClick={() => handleViewPDF(file)}>
                                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                                  View PDF
                                </DropdownMenuItem>
                              )}
                              {canExtract && (
                                <DropdownMenuItem onClick={() => handleExtract(file)} disabled={extracting}>
                                  <Package className="h-4 w-4 mr-2" />
                                  Extract Here
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleCopyPath(file.path)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Copy path
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setInfoFile(file)}>
                                <Info className="h-4 w-4 mr-2" />
                                Info
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setRenameDialog({ open: true, file, newName: file.name })}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Rename
                              </DropdownMenuItem>
                              {file.type === "file" && (
                                <DropdownMenuItem onClick={() => handleDownload(file)}>
                                  <Download className="h-4 w-4 mr-2" />
                                  Download
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setDeleteDialog({ open: true, file })} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-52">
                        {canEdit && (
                          <ContextMenuItem onClick={() => handleOpenFile(file)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Edit
                          </ContextMenuItem>
                        )}
                        {canViewImage && (
                          <ContextMenuItem onClick={() => handleViewImage(file)}>
                            <FileImage className="h-4 w-4 mr-2" />
                            View Image
                          </ContextMenuItem>
                        )}
                        {canViewPDF && (
                          <ContextMenuItem onClick={() => handleViewPDF(file)}>
                            <FileSpreadsheet className="h-4 w-4 mr-2" />
                            View PDF
                          </ContextMenuItem>
                        )}
                        {canExtract && (
                          <ContextMenuItem onClick={() => handleExtract(file)} disabled={extracting}>
                            <Package className="h-4 w-4 mr-2" />
                            Extract Here
                          </ContextMenuItem>
                        )}
                        {file.type === "directory" && (
                          <>
                            <ContextMenuItem onClick={() => navigateTo(file.path)}>
                              <Folder className="h-4 w-4 mr-2" />
                              Open
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => handleOpenInTerminal(file.path)}>
                              <TerminalSquare className="h-4 w-4 mr-2" />
                              Open in Terminal
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => {
                              setCurrentPath(file.path);
                              setUploadDialog(true);
                            }}>
                              <Upload className="h-4 w-4 mr-2" />
                              Upload to this folder
                            </ContextMenuItem>
                          </>
                        )}
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => {
                          const filesToCompress = selectedPaths.size > 0 && selectedPaths.has(file.path)
                            ? files.filter(f => selectedPaths.has(f.path))
                            : [file];
                          const defaultName = filesToCompress.length === 1
                            ? filesToCompress[0].name.replace(/\.[^.]+$/, "")
                            : "archive";
                          setCompressDialog({ open: true, files: filesToCompress, archiveName: defaultName });
                        }}>
                          <FolderArchive className="h-4 w-4 mr-2" />
                          Compress to ZIP
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => {
                          if (!selectedPaths.has(file.path)) {
                            setSelectedPaths(new Set([file.path]));
                          }
                          setClipboard({ files: [file], operation: "copy" });
                          toast.success("Copied to clipboard");
                        }}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                          <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => {
                          if (!selectedPaths.has(file.path)) {
                            setSelectedPaths(new Set([file.path]));
                          }
                          setClipboard({ files: [file], operation: "cut" });
                          toast.success("Cut to clipboard");
                        }}>
                          <Scissors className="h-4 w-4 mr-2" />
                          Cut
                          <ContextMenuShortcut>Ctrl+X</ContextMenuShortcut>
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => handleCopyPath(file.path)}>
                          <Clipboard className="h-4 w-4 mr-2" />
                          Copy Path
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => setRenameDialog({ open: true, file, newName: file.name })}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Rename
                          <ContextMenuShortcut>F2</ContextMenuShortcut>
                        </ContextMenuItem>
                        {file.type === "file" && (
                          <ContextMenuItem onClick={() => handleDownload(file)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </ContextMenuItem>
                        )}
                        <ContextMenuItem onClick={() => setInfoFile(file)}>
                          <Info className="h-4 w-4 mr-2" />
                          Properties
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => setDeleteDialog({ open: true, file })} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                          <ContextMenuShortcut>Del</ContextMenuShortcut>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 p-2">
                  {sortedFiles.map((file) => {
                    const Icon = getFileIcon(file.name, file.type);
                    const canEdit = file.type === "file" && isEditableFile(file.name);
                    const canViewImage = file.type === "file" && isImageFile(file.name);
                    const canViewPDF = file.type === "file" && isPDFFile(file.name);
                    const canExtract = file.type === "file" && isArchiveFile(file.name);
                    const isSelected = selectedPaths.has(file.path);
                    const isInClipboard = clipboard?.files.some(f => f.path === file.path);
                    const isDropTarget = dropTargetPath === file.path;
                    const isDragged = draggedFile?.path === file.path;
                    return (
                      <ContextMenu key={file.path}>
                        <ContextMenuTrigger asChild>
                          <div
                            draggable
                            onDragStart={(e) => handleFileDragStart(e, file)}
                            onDragEnd={handleFileDragEnd}
                            onDragOver={(e) => file.type === "directory" && handleFolderDragOver(e, file)}
                            onDragLeave={handleFolderDragLeave}
                            onDrop={(e) => file.type === "directory" && handleFileDrop(e, file)}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (e.ctrlKey || e.metaKey) {
                                toggleFileSelection(file.path);
                              } else {
                                setSelectedPaths(new Set([file.path]));
                              }
                            }}
                            onDoubleClick={() => {
                              if (file.type === "directory") navigateTo(file.path);
                              else if (canEdit) handleOpenFile(file);
                              else if (canViewImage) handleViewImage(file);
                              else if (canViewPDF) handleViewPDF(file);
                            }}
                            className={`relative flex flex-col items-center p-3 rounded-lg border select-none cursor-pointer group transition-all ${
                              isSelected ? "bg-primary/15 border-primary shadow-sm" : "border-transparent hover:bg-muted/80 hover:border-border"
                            } ${isInClipboard && clipboard?.operation === "cut" ? "opacity-50" : ""} ${
                              isDropTarget ? "bg-primary/25 ring-2 ring-primary" : ""
                            } ${isDragged ? "opacity-40" : ""}`}
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  onClick={(e) => e.stopPropagation()}
                                  className="absolute top-1 right-1 h-5 w-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/20"
                                >
                                  <MoreVertical className="h-3 w-3" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canEdit && (
                                  <DropdownMenuItem onClick={() => handleOpenFile(file)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                )}
                                {canViewImage && (
                                  <DropdownMenuItem onClick={() => handleViewImage(file)}>
                                    <FileImage className="h-4 w-4 mr-2" />
                                    View
                                  </DropdownMenuItem>
                                )}
                                {canViewPDF && (
                                  <DropdownMenuItem onClick={() => handleViewPDF(file)}>
                                    <FileText className="h-4 w-4 mr-2" />
                                    View PDF
                                  </DropdownMenuItem>
                                )}
                                {canExtract && (
                                  <DropdownMenuItem onClick={() => handleExtract(file)} disabled={extracting}>
                                    <Package className="h-4 w-4 mr-2" />
                                    Extract Here
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleCopyPath(file.path)}>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Copy path
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setInfoFile(file)}>
                                  <Info className="h-4 w-4 mr-2" />
                                  Info
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setRenameDialog({ open: true, file, newName: file.name })}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Rename
                                </DropdownMenuItem>
                                {file.type === "file" && (
                                  <DropdownMenuItem onClick={() => handleDownload(file)}>
                                    <Download className="h-4 w-4 mr-2" />
                                    Download
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setDeleteDialog({ open: true, file })} className="text-destructive">
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            <Icon className={`h-10 w-10 mb-2 ${
                              file.type === "directory" ? "text-primary" :
                              canViewImage ? "text-purple-500" :
                              canViewPDF ? "text-red-500" :
                              canExtract ? "text-amber-500" :
                              "text-muted-foreground"
                            }`} />
                            <span className="text-xs text-center truncate w-full font-medium">{getDisplayName(file.name, file.type)}</span>
                            <span className="text-[10px] text-muted-foreground mt-0.5">{formatSize(file.size)}</span>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-52">
                          {canEdit && (
                            <ContextMenuItem onClick={() => handleOpenFile(file)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Edit
                            </ContextMenuItem>
                          )}
                          {canViewImage && (
                            <ContextMenuItem onClick={() => handleViewImage(file)}>
                              <FileImage className="h-4 w-4 mr-2" />
                              View Image
                            </ContextMenuItem>
                          )}
                          {canViewPDF && (
                            <ContextMenuItem onClick={() => handleViewPDF(file)}>
                              <FileText className="h-4 w-4 mr-2" />
                              View PDF
                            </ContextMenuItem>
                          )}
                          {canExtract && (
                            <ContextMenuItem onClick={() => handleExtract(file)} disabled={extracting}>
                              <Package className="h-4 w-4 mr-2" />
                              Extract Here
                            </ContextMenuItem>
                          )}
                          {file.type === "directory" && (
                            <>
                              <ContextMenuItem onClick={() => navigateTo(file.path)}>
                                <Folder className="h-4 w-4 mr-2" />
                                Open
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => handleOpenInTerminal(file.path)}>
                                <TerminalSquare className="h-4 w-4 mr-2" />
                                Open in Terminal
                              </ContextMenuItem>
                              <ContextMenuItem onClick={() => {
                                setCurrentPath(file.path);
                                setUploadDialog(true);
                              }}>
                                <Upload className="h-4 w-4 mr-2" />
                                Upload to this folder
                              </ContextMenuItem>
                            </>
                          )}
                          <ContextMenuSeparator />
                          <ContextMenuItem onClick={() => {
                            const defaultName = file.name.replace(/\.[^.]+$/, "");
                            setCompressDialog({ open: true, files: [file], archiveName: defaultName });
                          }}>
                            <FolderArchive className="h-4 w-4 mr-2" />
                            Compress to ZIP
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem onClick={() => {
                            setClipboard({ files: [file], operation: "copy" });
                            toast.success("Copied to clipboard");
                          }}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy
                            <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => {
                            setClipboard({ files: [file], operation: "cut" });
                            toast.success("Cut to clipboard");
                          }}>
                            <Scissors className="h-4 w-4 mr-2" />
                            Cut
                            <ContextMenuShortcut>Ctrl+X</ContextMenuShortcut>
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => handleCopyPath(file.path)}>
                            <Clipboard className="h-4 w-4 mr-2" />
                            Copy Path
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem onClick={() => setRenameDialog({ open: true, file, newName: file.name })}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Rename
                            <ContextMenuShortcut>F2</ContextMenuShortcut>
                          </ContextMenuItem>
                          {file.type === "file" && (
                            <ContextMenuItem onClick={() => handleDownload(file)}>
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </ContextMenuItem>
                          )}
                          <ContextMenuItem onClick={() => setInfoFile(file)}>
                            <Info className="h-4 w-4 mr-2" />
                            Properties
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem onClick={() => setDeleteDialog({ open: true, file })} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                            <ContextMenuShortcut>Del</ContextMenuShortcut>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  })}
                </div>
              )}
                  {/* Empty space padding for context menu */}
                  <div className="min-h-[100px] w-full" />
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-52">
                <ContextMenuItem onClick={() => setCreateDialog({ open: true, type: "file", name: "" })}>
                  <FilePlus className="h-4 w-4 mr-2" />
                  New File
                </ContextMenuItem>
                <ContextMenuItem onClick={() => setCreateDialog({ open: true, type: "directory", name: "" })}>
                  <FolderPlus className="h-4 w-4 mr-2" />
                  New Folder
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => setUploadDialog(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Files
                </ContextMenuItem>
                {clipboard && clipboard.files.length > 0 && (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={handlePaste}>
                      <Clipboard className="h-4 w-4 mr-2" />
                      Paste ({clipboard.files.length})
                      <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
                    </ContextMenuItem>
                  </>
                )}
                <ContextMenuSeparator />
                <ContextMenuItem onClick={selectAllFiles}>
                  <Files className="h-4 w-4 mr-2" />
                  Select All
                  <ContextMenuShortcut>Ctrl+A</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem onClick={fetchFiles}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          </ScrollArea>
        )}
      </CardContent>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, file: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteDialog.file?.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <span className="font-semibold">{deleteDialog.file?.name}</span>?
              {deleteDialog.file?.type === "directory" && " This will delete all contents."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Dialog */}
      <Dialog open={createDialog.open} onOpenChange={(open) => !open && setCreateDialog({ open: false, type: "file", name: "" })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New {createDialog.type === "directory" ? "Folder" : "File"}</DialogTitle>
            <DialogDescription>Enter a name.</DialogDescription>
          </DialogHeader>
          <Input
            placeholder={createDialog.type === "directory" ? "folder-name" : "filename.txt"}
            value={createDialog.name}
            onChange={(e) => setCreateDialog((prev) => ({ ...prev, name: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog({ open: false, type: "file", name: "" })}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!createDialog.name.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog - File Selection Only */}
      <Dialog open={uploadDialog} onOpenChange={(open) => setUploadDialog(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Files</DialogTitle>
            <DialogDescription>Upload to {currentPath}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <Input
                type="file"
                multiple
                className="hidden"
                id="file-upload"
                onChange={(e) => {
                  const newFiles = Array.from(e.target.files || []);
                  setSelectedFiles(prev => {
                    const existingNames = new Set(prev.map(f => f.name + f.size));
                    const uniqueNewFiles = newFiles.filter(f => !existingNames.has(f.name + f.size));
                    return [...prev, ...uniqueNewFiles];
                  });
                  e.target.value = ""; // Reset input to allow re-selecting same files
                }}
              />
              <Input
                type="file"
                /* @ts-ignore */
                webkitdirectory=""
                directory=""
                multiple
                className="hidden"
                id="folder-upload"
                onChange={(e) => {
                  const newFiles = Array.from(e.target.files || []);
                  setSelectedFiles(prev => {
                    const existingNames = new Set(prev.map(f => f.name + f.size));
                    const uniqueNewFiles = newFiles.filter(f => !existingNames.has(f.name + f.size));
                    return [...prev, ...uniqueNewFiles];
                  });
                  e.target.value = ""; // Reset input to allow re-selecting same files
                }}
              />
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <div className="flex gap-2">
                  <label htmlFor="file-upload" className="cursor-pointer text-xs text-primary hover:underline">
                    {selectedFiles.length > 0 ? "Add Files" : "Select Files"}
                  </label>
                  <span className="text-xs text-muted-foreground">or</span>
                  <label htmlFor="folder-upload" className="cursor-pointer text-xs text-primary hover:underline">
                    {selectedFiles.length > 0 ? "Add Folder" : "Select Folder"}
                  </label>
                </div>
                <span className="text-xs text-muted-foreground">or drag and drop files/folders</span>
              </div>
            </div>
            {selectedFiles.length > 0 && (
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-medium">{selectedFiles.length} file(s) selected</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">
                      {formatSize(selectedFiles.reduce((acc, f) => acc + f.size, 0))}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setSelectedFiles([])}
                    >
                      Clear all
                    </Button>
                  </div>
                </div>
                <ScrollArea className="max-h-32">
                  <div className="space-y-1">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between text-xs p-1.5 bg-muted rounded group">
                        <span className="truncate flex-1">{file.name}</span>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <span className="text-muted-foreground">{formatSize(file.size)}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                            onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setUploadDialog(false); setSelectedFiles([]); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => handleUpload(false)} disabled={selectedFiles.length === 0}>
              <Upload className="h-3 w-3 mr-1" />
              Upload {selectedFiles.length > 0 && `(${selectedFiles.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Code Editor with Syntax Highlighting */}
      <Dialog
        open={editDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setEditDialog({ open: false, file: null, content: "", loading: false, saving: false });
            setFindReplace({ show: false, findText: "", replaceText: "", matchCount: 0 });
          }
        }}
      >
        <DialogContent className="max-w-7xl h-[90vh] flex flex-col p-0" showCloseButton={false}>
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="flex items-center gap-2">
              <FileCode className="h-4 w-4 text-primary" />
              <div>
                <h3 className="text-sm font-semibold">{editDialog.file?.name}</h3>
                <p className="text-[10px] text-muted-foreground">{editDialog.file?.path}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px] h-5">{editDialog.file && getDisplayLanguage(editDialog.file.name)}</Badge>
              <Badge variant="secondary" className="text-[10px] h-5">{getLineCount(editDialog.content)} lines</Badge>
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <Button
                variant={findReplace.show ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setFindReplace((prev) => ({ ...prev, show: !prev.show }))}
              >
                <Search className="h-3 w-3 mr-1" />
                Find
              </Button>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-1.5">
                <Label htmlFor="word-wrap" className="text-[10px]">Wrap</Label>
                <Switch
                  id="word-wrap"
                  className="scale-75"
                  checked={editorSettings.wordWrap}
                  onCheckedChange={(checked) => setEditorSettings((prev) => ({ ...prev, wordWrap: checked }))}
                />
              </div>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setEditorSettings((prev) => ({ ...prev, fontSize: Math.max(10, prev.fontSize - 2) }))}
                >
                  <span className="text-[10px]">A-</span>
                </Button>
                <span className="text-[10px] w-5 text-center">{editorSettings.fontSize}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setEditorSettings((prev) => ({ ...prev, fontSize: Math.min(24, prev.fontSize + 2) }))}
                >
                  <span className="text-[10px]">A+</span>
                </Button>
              </div>
            </div>
            <span className="text-[10px] text-muted-foreground">Ctrl+S to save</span>
          </div>

          {findReplace.show && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 border-b bg-muted/20">
              <Input
                placeholder="Find..."
                value={findReplace.findText}
                onChange={(e) => { setFindReplace((prev) => ({ ...prev, findText: e.target.value })); handleFind(e.target.value); }}
                className="h-7 text-xs max-w-[150px]"
              />
              <Input
                placeholder="Replace..."
                value={findReplace.replaceText}
                onChange={(e) => setFindReplace((prev) => ({ ...prev, replaceText: e.target.value }))}
                className="h-7 text-xs max-w-[150px]"
              />
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleReplace}>Replace</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleReplaceAll}>All</Button>
              {findReplace.matchCount > 0 && <span className="text-[10px] text-muted-foreground">{findReplace.matchCount} found</span>}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 ml-auto"
                onClick={() => setFindReplace({ show: false, findText: "", replaceText: "", matchCount: 0 })}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-auto">
            {editDialog.loading ? (
              <div className="flex items-center justify-center h-full">
                <Spinner className="h-6 w-6" />
              </div>
            ) : (
              <CodeEditor
                value={editDialog.content}
                language={editDialog.file ? getLanguage(editDialog.file.name) : "plaintext"}
                placeholder="Enter code here..."
                onChange={(e) => setEditDialog((prev) => ({ ...prev, content: e.target.value }))}
                padding={12}
                style={{
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  fontSize: editorSettings.fontSize,
                  minHeight: "100%",
                  backgroundColor: "var(--background)",
                }}
                className="min-h-full"
                data-color-mode="dark"
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); handleSaveFile(); }
                  if ((e.ctrlKey || e.metaKey) && e.key === "f") { e.preventDefault(); setFindReplace((prev) => ({ ...prev, show: true })); }
                }}
              />
            )}
          </div>

          <div className="flex items-center justify-between px-3 py-2 border-t">
            <span className="text-[10px] text-muted-foreground">{editDialog.content.length} chars</span>
            <Button size="sm" onClick={handleSaveFile} disabled={editDialog.loading || editDialog.saving}>
              {editDialog.saving ? <Spinner className="h-3 w-3 mr-1" /> : <Save className="h-3 w-3 mr-1" />}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={renameDialog.open} onOpenChange={(open) => !open && setRenameDialog({ open: false, file: null, newName: "" })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
            <DialogDescription>Enter new name for {renameDialog.file?.name}</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Enter new name..."
            value={renameDialog.newName}
            onChange={(e) => setRenameDialog((prev) => ({ ...prev, newName: e.target.value }))}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRenameDialog({ open: false, file: null, newName: "" })}>Cancel</Button>
            <Button size="sm" onClick={handleRename} disabled={!renameDialog.newName.trim() || renameDialog.newName === renameDialog.file?.name}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enhanced Image Viewer */}
      <Dialog open={imageViewer.open} onOpenChange={(open) => !open && closeImageViewer()}>
        <DialogContent className={`flex flex-col p-0 ${imageViewer.isFullscreen ? "max-w-none w-screen h-screen rounded-none" : "max-w-[90vw] lg:max-w-7xl h-[90vh]"}`} showCloseButton={false}>
          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-background/95 backdrop-blur shrink-0">
            <div className="flex items-center gap-2">
              <FileImage className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium truncate max-w-[200px]">{imageViewer.file?.name}</span>
              {allImages.length > 1 && (
                <Badge variant="secondary" className="text-[10px]">
                  {currentImageIndex + 1} / {allImages.length}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Navigation */}
              {allImages.length > 1 && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateImage("prev")}>
                        <SkipBack className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Previous image</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleSlideshow}>
                        {isSlideshow ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isSlideshow ? "Stop slideshow" : "Start slideshow"}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateImage("next")}>
                        <SkipForward className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Next image</TooltipContent>
                  </Tooltip>
                  <Separator orientation="vertical" className="h-4 mx-1" />
                </>
              )}

              {/* Zoom */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setImageViewer(prev => ({ ...prev, zoom: Math.max(25, prev.zoom - 25) }))}>
                    <ZoomOut className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom out</TooltipContent>
              </Tooltip>
              <span className="text-xs w-10 text-center">{imageViewer.zoom}%</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setImageViewer(prev => ({ ...prev, zoom: Math.min(400, prev.zoom + 25) }))}>
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom in</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setImageViewer(prev => ({ ...prev, zoom: 100, rotation: 0, flipH: false, flipV: false }))}>
                    <Minimize2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset view</TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="h-4 mx-1" />

              {/* Rotate & Flip */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setImageViewer(prev => ({ ...prev, rotation: (prev.rotation - 90 + 360) % 360 }))}>
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Rotate left</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setImageViewer(prev => ({ ...prev, rotation: (prev.rotation + 90) % 360 }))}>
                    <RotateCw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Rotate right</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant={imageViewer.flipH ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setImageViewer(prev => ({ ...prev, flipH: !prev.flipH }))}>
                    <FlipHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Flip horizontal</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant={imageViewer.flipV ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setImageViewer(prev => ({ ...prev, flipV: !prev.flipV }))}>
                    <FlipVertical className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Flip vertical</TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="h-4 mx-1" />

              {/* Fullscreen & Download */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setImageViewer(prev => ({ ...prev, isFullscreen: !prev.isFullscreen }))}>
                    {imageViewer.isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{imageViewer.isFullscreen ? "Exit fullscreen" : "Fullscreen"}</TooltipContent>
              </Tooltip>
              {imageViewer.file && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => imageViewer.file && handleDownload(imageViewer.file)}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Download</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closeImageViewer}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Close</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Image Content */}
          <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center bg-muted/20 p-4">
            {imageViewer.loading ? (
              <Spinner className="h-8 w-8" />
            ) : imageViewer.error ? (
              <div className="text-center text-destructive">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">{imageViewer.error}</p>
              </div>
            ) : imageViewer.imageUrl ? (
              <div
                style={{
                  transform: `scale(${imageViewer.zoom / 100}) rotate(${imageViewer.rotation}deg) scaleX(${imageViewer.flipH ? -1 : 1}) scaleY(${imageViewer.flipV ? -1 : 1})`,
                  transition: "transform 0.2s ease-out",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageViewer.imageUrl}
                  alt={imageViewer.file?.name || "Image"}
                  className="max-w-full max-h-full object-contain rounded shadow-lg"
                  draggable={false}
                />
              </div>
            ) : null}
          </div>

          {/* Status Bar */}
          <div className="flex items-center justify-between px-3 py-1 border-t bg-muted/30 text-xs text-muted-foreground shrink-0">
            <span>{imageViewer.file?.path}</span>
            <span>{imageViewer.file && formatSize(imageViewer.file.size)}</span>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF Viewer */}
      <Dialog open={pdfViewer.open} onOpenChange={(open) => !open && closePdfViewer()}>
        <DialogContent className="max-w-[90vw] lg:max-w-7xl h-[90vh] flex flex-col p-0" showCloseButton={false}>
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium truncate max-w-[300px]">{pdfViewer.file?.name}</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closePdfViewer}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex-1 min-h-0">
            {pdfViewer.loading ? (
              <div className="flex items-center justify-center h-full">
                <Spinner className="h-8 w-8" />
              </div>
            ) : pdfViewer.error ? (
              <div className="flex flex-col items-center justify-center h-full text-destructive">
                <AlertTriangle className="h-8 w-8 mb-2" />
                <p className="text-sm">{pdfViewer.error}</p>
              </div>
            ) : pdfViewer.pdfUrl ? (
              <PDFViewer
                url={pdfViewer.pdfUrl}
                fileName={pdfViewer.file?.name}
                onDownload={() => pdfViewer.file && handleDownload(pdfViewer.file)}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Keyboard Shortcuts Help */}
      <Dialog open={showShortcutsHelp} onOpenChange={setShowShortcutsHelp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription>Quick reference for file manager shortcuts</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-auto">
            <div>
              <h4 className="text-sm font-medium mb-2">Selection</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Select all</span><kbd className="bg-muted px-2 py-0.5 rounded text-xs">Ctrl+A</kbd></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Clear selection</span><kbd className="bg-muted px-2 py-0.5 rounded text-xs">Esc</kbd></div>
              </div>
            </div>
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-2">File Operations</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Copy</span><kbd className="bg-muted px-2 py-0.5 rounded text-xs">Ctrl+C</kbd></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Cut</span><kbd className="bg-muted px-2 py-0.5 rounded text-xs">Ctrl+X</kbd></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paste</span><kbd className="bg-muted px-2 py-0.5 rounded text-xs">Ctrl+V</kbd></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Delete</span><kbd className="bg-muted px-2 py-0.5 rounded text-xs">Delete</kbd></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Rename</span><kbd className="bg-muted px-2 py-0.5 rounded text-xs">F2</kbd></div>
              </div>
            </div>
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-2">Navigation</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Search</span><kbd className="bg-muted px-2 py-0.5 rounded text-xs">Ctrl+F</kbd></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Refresh</span><kbd className="bg-muted px-2 py-0.5 rounded text-xs">F5</kbd></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Show shortcuts</span><kbd className="bg-muted px-2 py-0.5 rounded text-xs">?</kbd></div>
              </div>
            </div>
            <Separator />
            <div>
              <h4 className="text-sm font-medium mb-2">Editor</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Save file</span><kbd className="bg-muted px-2 py-0.5 rounded text-xs">Ctrl+S</kbd></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Find in file</span><kbd className="bg-muted px-2 py-0.5 rounded text-xs">Ctrl+F</kbd></div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShortcutsHelp(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Info Dialog */}
      <Dialog open={infoFile !== null} onOpenChange={(open) => !open && setInfoFile(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              {infoFile && (() => { const Icon = getFileIcon(infoFile.name, infoFile.type); return <Icon className="h-4 w-4" />; })()}
              File Info
            </DialogTitle>
          </DialogHeader>
          {infoFile && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium truncate max-w-[180px]">{infoFile.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <Badge variant="outline" className="text-[10px]">{infoFile.type === "directory" ? "Folder" : infoFile.name.split(".").pop()?.toUpperCase() || "File"}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Size</span>
                <span>{formatSize(infoFile.size)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Modified</span>
                <span>{new Date(infoFile.modified).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Permissions</span>
                <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{infoFile.permissions}</code>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Path</span>
                <div className="flex items-center gap-1">
                  <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded truncate max-w-[120px]">{infoFile.path}</code>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleCopyPath(infoFile.path)}>
                    {copiedPath === infoFile.path ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
              {infoFile.type === "file" && isEditableFile(infoFile.name) && (
                <Button className="w-full mt-2" size="sm" onClick={() => { handleOpenFile(infoFile); setInfoFile(null); }}>
                  <Eye className="h-3 w-3 mr-1" />
                  Open in Editor
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* File Conflict Dialog */}
      <AlertDialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Overwrite Existing Files?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>The following {conflictingFiles.length} file(s) already exist in this directory:</p>
              <ScrollArea className="max-h-32 border rounded-md p-2">
                <div className="space-y-1">
                  {conflictingFiles.map((fileName, index) => (
                    <div key={index} className="text-xs font-mono bg-muted px-2 py-1 rounded">
                      {fileName}
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <p className="text-sm">Do you want to overwrite them?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowConflictDialog(false);
              setConflictingFiles([]);
              setSelectedFiles([]); // Clear selected files since upload dialog is closed
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowConflictDialog(false);
              setConflictingFiles([]);
              handleUpload(true);
            }}>
              Overwrite
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Compress Dialog */}
      <Dialog open={compressDialog.open} onOpenChange={(open) => !open && setCompressDialog({ open: false, files: [], archiveName: "" })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderArchive className="h-5 w-5" />
              Compress Files
            </DialogTitle>
            <DialogDescription>
              Create a ZIP archive from {compressDialog.files.length} selected item(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="archive-name">Archive name</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="archive-name"
                  placeholder="archive"
                  value={compressDialog.archiveName}
                  onChange={(e) => setCompressDialog(prev => ({ ...prev, archiveName: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && handleCompress()}
                />
                <Badge variant="secondary">.zip</Badge>
              </div>
            </div>
            {compressDialog.files.length > 0 && (
              <div className="space-y-2">
                <Label>Files to compress</Label>
                <ScrollArea className="max-h-32 border rounded-md p-2">
                  <div className="space-y-1">
                    {compressDialog.files.map((file) => {
                      const Icon = getFileIcon(file.name, file.type);
                      return (
                        <div key={file.path} className="flex items-center gap-2 text-xs">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate">{file.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompressDialog({ open: false, files: [], archiveName: "" })}>
              Cancel
            </Button>
            <Button onClick={handleCompress} disabled={!compressDialog.archiveName.trim()}>
              <FolderArchive className="h-4 w-4 mr-2" />
              Compress
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
