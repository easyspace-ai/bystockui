import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SavedStrategyRenameDialogProps {
  label: string;
  description: string;
  onSave: (label: string, description: string) => void;
  triggerClassName?: string;
  showDescription?: boolean;
}

export function SavedStrategyRenameDialog({
  label,
  description,
  onSave,
  triggerClassName,
  showDescription = true,
}: SavedStrategyRenameDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(label);
  const [desc, setDesc] = useState(description);

  useEffect(() => {
    if (open) {
      setName(label);
      setDesc(description);
    }
  }, [open, label, description]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, desc.trim());
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        }
        title="重命名策略"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>重命名策略</AlertDialogTitle>
            <AlertDialogDescription>修改策略名称与说明，侧边栏和详情页会同步更新。</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">策略名称</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="输入策略名称" />
            </div>
            {showDescription && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">策略说明</label>
                <Textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="输入策略说明"
                  rows={3}
                  className="resize-none text-sm"
                />
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <Button onClick={handleSave} disabled={!name.trim()}>
              保存
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
