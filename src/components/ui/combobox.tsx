"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface ComboboxProps {
    options: { label: string; value: string; color?: string }[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    onAdd?: (name: string) => void;
}

export function Combobox({ options, value, onChange, placeholder, onAdd }: ComboboxProps) {
    const [open, setOpen] = React.useState(false);
    const [searchValue, setSearchValue] = React.useState("");

    const selectedOption = options.find((opt) => opt.value === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between h-11 rounded-xl bg-background/50 border-muted font-normal text-muted-foreground"
                >
                    {selectedOption ? (
                        <div className="flex items-center gap-2">
                            {selectedOption.color && (
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: selectedOption.color }}
                                />
                            )}
                            <span className="text-foreground">{selectedOption.label}</span>
                        </div>
                    ) : (
                        placeholder || "Selecionar..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 rounded-xl overflow-hidden border-none shadow-2xl">
                <Command>
                    <CommandInput
                        placeholder="Pesquisar..."
                        value={searchValue}
                        onValueChange={setSearchValue}
                    />
                    <CommandList>
                        <CommandEmpty className="p-2">
                            <p className="text-xs text-muted-foreground mb-2 text-center">Nenhum resultado.</p>
                            {onAdd && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="w-full text-xs h-8 rounded-lg"
                                    onClick={() => {
                                        onAdd(searchValue);
                                        setOpen(false);
                                    }}
                                >
                                    <Plus className="mr-2 h-3 w-3" />
                                    Adicionar "{searchValue}"
                                </Button>
                            )}
                        </CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => {
                                        onChange(option.value);
                                        setOpen(false);
                                    }}
                                    className="rounded-lg m-1"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === option.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <div className="flex items-center gap-2">
                                        {option.color && (
                                            <div
                                                className="w-2.5 h-2.5 rounded-full"
                                                style={{ backgroundColor: option.color }}
                                            />
                                        )}
                                        {option.label}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
