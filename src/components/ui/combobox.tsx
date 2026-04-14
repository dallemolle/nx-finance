"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

    const filteredOptions = options.filter((option) =>
        option.label.toLowerCase().includes(search.toLowerCase())
    )

    const showAddButton = onAdd && search && !options.some(
        (o) => o.label.toLowerCase() === search.toLowerCase()
    )

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
                className="p-1 pointer-events-auto"
                style={{ width: 'var(--radix-popover-trigger-width)' }}
                align="start"
                portal={true}
            >
                <div className="flex flex-col gap-1 p-1">
                    <Input
                        placeholder={searchPlaceholder}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-9 mb-1"
                    />
                    
                    <div
                        className="max-h-[200px] overflow-y-auto overflow-x-hidden flex flex-col gap-0.5"
                        onWheel={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{ touchAction: 'pan-y' }}
                    >
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={cn(
                                        "flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                                        "hover:bg-accent hover:text-accent-foreground",
                                        value === option.value ? "bg-accent/50" : "transparent"
                                    )}
                                    onClick={() => {
                                        onValueChange(option.value)
                                        setOpen(false)
                                        setSearch("")
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4 shrink-0",
                                            value === option.value ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    <span className="truncate">{option.label}</span>
                                </button>
                            ))
                        ) : (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                {emptyMessage}
                            </div>
                        )}

                        {showAddButton && (
                            <button
                                type="button"
                                className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm font-medium text-primary hover:bg-accent outline-none"
                                onClick={() => {
                                    onAdd(search)
                                    setOpen(false)
                                    setSearch("")
                                }}
                            >
                                <Plus className="mr-2 h-4 w-4 shrink-0" />
                                <span className="truncate text-left">Criar "{search}"</span>
                            </button>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
