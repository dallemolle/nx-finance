"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    ...props
}: CalendarProps) {
    return (
        <DayPicker
            showOutsideDays={showOutsideDays}
            className={cn("p-4", className)}
            classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-6",
                month_caption: "flex justify-center pt-1 relative items-center px-10",
                caption_label: "text-sm font-semibold tracking-tight uppercase",
                nav: "space-x-1 flex items-center",
                button_previous: cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-8 w-8 bg-transparent p-0 opacity-40 hover:opacity-100 transition-opacity absolute left-2 top-0"
                ),
                button_next: cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-8 w-8 bg-transparent p-0 opacity-40 hover:opacity-100 transition-opacity absolute right-2 top-0"
                ),
                month_grid: "w-full border-collapse select-none",
                weekdays: "grid grid-cols-7 w-full mb-2",
                weekday:
                    "text-muted-foreground/50 rounded-md font-medium text-[0.7rem] uppercase tracking-wider text-center w-full",
                week: "grid grid-cols-7 w-full mt-1",
                day: cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-9 w-full p-0 font-normal hover:bg-accent/50 transition-colors"
                ),
                day_button: "h-9 w-full p-0 font-normal",
                range_start: "day-range-start",
                range_end: "day-range-end",
                selected:
                    "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground shadow-sm rounded-md",
                today: "bg-accent/30 text-accent-foreground font-semibold rounded-md",
                outside:
                    "day-outside text-muted-foreground/30 opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
                disabled: "text-muted-foreground opacity-30",
                range_middle:
                    "aria-selected:bg-accent aria-selected:text-accent-foreground",
                hidden: "invisible",
                ...classNames,
            }}
            components={{
                Chevron: ({ ...props }) => props.orientation === 'left' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />,
            }}
            {...props}
        />
    )
}
Calendar.displayName = "Calendar"

export { Calendar }
