"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxProps {
    options: { value: string; label: string }[]
    value: string
    onValueChange: (value: string) => void
    onAdd?: (search: string) => void
    placeholder?: string
    searchPlaceholder?: string
    emptyMessage?: string
}

export function Combobox({
    options,
    value,
    onValueChange,
    onAdd,
    placeholder = "Selecione uma opção...",
    searchPlaceholder = "Procurar...",
    emptyMessage = "Nenhum resultado encontrado.",
}: ComboboxProps) {
    const [open, setOpen] = React.useState(false)
    const [search, setSearch] = React.useState("")

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                >
                    {value
                        ? options.find((option) => option.value === value)?.label
                        : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="p-0 pointer-events-auto z-[9999]"
                style={{ width: 'var(--radix-popover-trigger-width)' }}
                align="start"
            >
                <Command shouldFilter={true}>
                    <CommandInput
                        placeholder={searchPlaceholder}
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList>
                        <CommandEmpty>
                            <div className="flex flex-col items-center gap-2 p-4">
                                <p className="text-sm text-muted-foreground">{emptyMessage}</p>
                                {onAdd && search && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="w-full flex items-center justify-center gap-2"
                                        onClick={() => {
                                            onAdd(search)
                                            setOpen(false)
                                            setSearch("")
                                        }}
                                    >
                                        <Plus className="h-4 w-4" />
                                        Criar "{search}"
                                    </Button>
                                )}
                            </div>
                        </CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => {
                                        onValueChange(option.value)
                                        setOpen(false)
                                        setSearch("")
                                    }}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                    }}
                                    className="cursor-pointer hover:bg-accent hover:text-accent-foreground"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === option.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {option.label}
                                </CommandItem>
                            ))}
                            {onAdd && search && options.every(o => o.label.toLowerCase() !== search.toLowerCase()) && (
                                <CommandItem
                                    value={search}
                                    onSelect={() => {
                                        onAdd(search)
                                        setOpen(false)
                                        setSearch("")
                                    }}
                                    className="text-primary font-medium"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Criar "{search}"
                                </CommandItem>
                            )}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
