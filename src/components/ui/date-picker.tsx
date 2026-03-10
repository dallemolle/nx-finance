"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { ptBR } from "date-fns/locale"

interface DatePickerProps {
    date?: Date
    setDate: (date?: Date) => void
    placeholder?: string
}

export function DatePicker({ date, setDate, placeholder = "Escolha uma data" }: DatePickerProps) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "w-full justify-start text-left font-normal bg-background/50 border-muted hover:border-primary/50 transition-colors h-11",
                        !date && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-3 h-4 w-4 opacity-70" />
                    <span className="font-medium">
                        {date ? format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : <span>{placeholder}</span>}
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-0 border-none shadow-2xl rounded-2xl overflow-hidden" align="start" sideOffset={8}>
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                        setDate(d)
                    }}
                    initialFocus
                    locale={ptBR}
                    className="p-5"
                />
            </PopoverContent>
        </Popover>
    )
}
