"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { sheetBody, fieldGap } from "@/lib/design";
import { Upload, Trash2, Plus, X } from "lucide-react";

interface RampStage {
  pct: number;
  rate: number;
}

export interface EditableTrend {
  id: string;
  name: string;
  incrementRate: number;
  rampStages?: string | null;
  isTakeoverTrend?: boolean;
  color?: string | null;
}

const DEFAULT_COLOR = "#171717";

interface AddTrendSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    id?: string;
    name: string;
    incrementRate: number;
    imageFile?: File;
    rampStages?: string;
    isTakeoverTrend?: boolean;
    color?: string;
  }) => Promise<void>;
  loading?: boolean;
  editingTrend?: EditableTrend | null;
}

export function AddTrendSheet({
  open,
  onOpenChange,
  onSubmit,
  loading = false,
  editingTrend = null,
}: AddTrendSheetProps) {
  const [name, setName] = useState("");
  const [flatRate, setFlatRate] = useState("0");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [rampStages, setRampStages] = useState<RampStage[]>([]);
  const [isTakeover, setIsTakeover] = useState(false);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditing = !!editingTrend;

  useEffect(() => {
    if (!open) return;
    if (editingTrend) {
      setName(editingTrend.name);
      setFlatRate((editingTrend.incrementRate ?? 0).toString());
      setRampStages(
        editingTrend.rampStages ? JSON.parse(editingTrend.rampStages) : []
      );
      setIsTakeover(!!editingTrend.isTakeoverTrend);
      setColor(editingTrend.color || DEFAULT_COLOR);
    } else {
      setName("");
      setFlatRate("0");
      setImageFile(null);
      setImagePreview(null);
      setRampStages([]);
      setIsTakeover(false);
      setColor(DEFAULT_COLOR);
    }
  }, [open, editingTrend]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const addRampStage = () => {
    const last = rampStages[rampStages.length - 1];
    const nextPct = last ? Math.min(100, last.pct + 25) : 25;
    const nextRate = last ? last.rate : parseInt(flatRate) || 10;
    setRampStages([...rampStages, { pct: nextPct, rate: nextRate }]);
  };

  const removeRampStage = (index: number) => {
    setRampStages(rampStages.filter((_, i) => i !== index));
  };

  const updateRampStage = (index: number, field: "pct" | "rate", value: number) => {
    const updated = [...rampStages];
    updated[index][field] = value;
    setRampStages(updated);
  };

  async function handleSubmit() {
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit({
        id: editingTrend?.id,
        name,
        incrementRate: parseInt(flatRate) || 0,
        imageFile: imageFile ?? undefined,
        rampStages: rampStages.length > 0 ? JSON.stringify(rampStages) : undefined,
        isTakeoverTrend: isTakeover,
        color,
      });

      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Trend" : "Add New Trend"}</SheetTitle>
        </SheetHeader>

        <div className={sheetBody}>
          {/* Name */}
          <div className={fieldGap}>
            <Label htmlFor="trendName">Trend Name</Label>
            <Input
              id="trendName"
              placeholder="e.g. Sign-ups"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>

          {/* Image Upload */}
          <div className={fieldGap}>
            <Label>Image (optional)</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                className="gap-1.5 flex-1"
              >
                <Upload className="h-4 w-4" />
                Upload
              </Button>
              {imageFile && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearImage}
                  disabled={submitting}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
              disabled={submitting}
            />
            {imagePreview && (
              <div className="mt-2 rounded-md border border-border p-2 bg-muted/30">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-20 w-auto object-contain"
                />
              </div>
            )}
          </div>

          {/* Flat Rate */}
          <div className={fieldGap}>
            <Label htmlFor="flatRate">Base Rate (per minute)</Label>
            <Input
              id="flatRate"
              type="number"
              min="0"
              value={flatRate === "0" ? "" : flatRate}
              onChange={(e) => setFlatRate(e.target.value || "0")}
              onFocus={(e) => e.target.select()}
              disabled={submitting}
            />
            <p className="text-xs text-muted-foreground">
              Used when no ramp stages are defined
            </p>
          </div>

          {/* Bar Color */}
          <div className={fieldGap}>
            <Label htmlFor="color">Graph Color</Label>
            <div className="flex items-center gap-2">
              <input
                id="color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={submitting}
                className="h-9 w-14 rounded-md border border-input bg-background p-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              />
              <Input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={submitting}
                className="w-28"
              />
            </div>
          </div>

          {/* Ramp Stages */}
          <div className={fieldGap}>
            <Label>Ramp Stages (optional)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Define how rate changes over session duration (% of session, rate/min)
            </p>

            {rampStages.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No stages defined. Will use flat rate above.
              </p>
            ) : (
              <div className="space-y-2 mb-3">
                {rampStages.map((stage, idx) => (
                  <div key={idx} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground block mb-1">
                        % of session
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={stage.pct === 0 ? "" : stage.pct}
                        onChange={(e) =>
                          updateRampStage(idx, "pct", parseFloat(e.target.value) || 0)
                        }
                        onFocus={(e) => e.target.select()}
                        disabled={submitting}
                        className="text-sm h-8"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground block mb-1">
                        Rate/min
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={stage.rate === 0 ? "" : stage.rate}
                        onChange={(e) =>
                          updateRampStage(idx, "rate", parseFloat(e.target.value) || 0)
                        }
                        onFocus={(e) => e.target.select()}
                        disabled={submitting}
                        className="text-sm h-8"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeRampStage(idx)}
                      disabled={submitting}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addRampStage}
              disabled={submitting}
              className="gap-1.5 w-full"
            >
              <Plus className="h-4 w-4" />
              Add Stage
            </Button>
          </div>

          {/* Takeover Trend */}
          <div className={fieldGap}>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isTakeover"
                checked={isTakeover}
                onChange={(e) => setIsTakeover(e.target.checked)}
                disabled={submitting}
                className="rounded border-border"
              />
              <Label htmlFor="isTakeover" className="font-normal cursor-pointer">
                Mark as takeover trend
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Automatically hidden and revealed during takeover event. Only one per session.
            </p>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            className="w-full"
          >
            {submitting
              ? isEditing
                ? "Saving..."
                : "Creating..."
              : isEditing
                ? "Save Changes"
                : "Add Trend"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
