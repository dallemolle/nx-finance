"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFinancialInstitution } from "@/lib/actions";
import { toast } from "sonner";

interface InstitutionComboboxProps {
  options: { id: string; nome: string; cor?: string | null }[];
  value?: string | null;
  onValueChange: (value: string) => void;
  onAdded?: (newInstitution: any) => void;
}

export function InstitutionCombobox({ options, value, onValueChange, onAdded }: InstitutionComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");

  const [newName, setNewName] = React.useState("");
  const [newColor, setNewColor] = React.useState("#6366f1");
  const [isCreating, setIsCreating] = React.useState(false);

  const selectedOption = options.find((opt) => opt.id === value);

  const filteredOptions = options.filter((opt) =>
    opt.nome.toLowerCase().includes(searchValue.toLowerCase())
  );

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setIsCreating(true);
    try {
      const newInst = await createFinancialInstitution({
        nome: newName,
        cor: newColor,
      });
      toast.success("Instituição criada com sucesso!");
      onValueChange(newInst.id);
      if (onAdded) onAdded(newInst);
      setDialogOpen(false);
      setOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar instituição.");
    } finally {
      setIsCreating(false);
    }
  };

  const openCreateDialog = (name: string) => {
    setNewName(name);
    setNewColor("#6366f1"); // Default color
    setDialogOpen(true);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {value ? selectedOption?.nome : "Selecione a Instituição"}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[300px] p-1 pointer-events-auto"
          portal={false}
        >
          <div className="flex flex-col gap-1 p-1">
            <Input
              placeholder="Buscar instituição..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="h-9 mb-1"
            />
            
            <div 
              className="max-h-[200px] overflow-y-auto overflow-x-hidden flex flex-col gap-0.5"
              onWheel={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              style={{ touchAction: 'pan-y' }}
            >
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={cn(
                        "flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                        "hover:bg-accent hover:text-accent-foreground",
                        value === opt.id ? "bg-accent/50" : "transparent"
                    )}
                    onClick={() => {
                      onValueChange(opt.id);
                      setOpen(false);
                      setSearchValue("");
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === opt.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center gap-2 truncate">
                        {opt.cor && (
                            <div 
                                className="w-3 h-3 rounded-full shrink-0" 
                                style={{ backgroundColor: opt.cor }} 
                            />
                        )}
                        <span className="truncate">{opt.nome}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground whitespace-normal p-2">
                  Nenhuma instituição encontrada.
                </div>
              )}

              {searchValue && !options.some(o => o.nome.toLowerCase() === searchValue.toLowerCase()) && (
                <button
                  type="button"
                  className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm font-medium text-primary hover:bg-accent outline-none"
                  onClick={() => openCreateDialog(searchValue)}
                >
                  <Plus className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate text-left">Cadastrar "{searchValue}"</span>
                </button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nova Instituição Financeira</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Nubank, Itaú..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cor">Cor de Destaque</Label>
              <div className="flex gap-2 items-center">
                  <input
                    id="cor"
                    type="color"
                    className="w-12 h-12 p-1 cursor-pointer bg-transparent border rounded-md"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                  />
                  <span className="text-sm border px-3 py-2 rounded-md font-mono flex-1">{newColor}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isCreating}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={isCreating}>
               {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
               Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
