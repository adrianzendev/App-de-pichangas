"use client"

import * as React from "react"
import { Check, Search, Clock, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner";

interface ComboboxOption {
  value: string
  label: string
}

// Helper function to highlight matched text
const highlightMatch = (text: string, query: string): string[] => {
  if (!query) return [text]
  const regex = new RegExp(`(${query})`, 'gi')
  const parts = text.split(regex)
  return parts
}

// Helper functions for recent selections storage
const RECENTS_KEY_PREFIX = 'miltareas_recents_'
const MAX_RECENTS = 5

const getRecents = (fieldId: string): ComboboxOption[] => {
  try {
    const stored = localStorage.getItem(RECENTS_KEY_PREFIX + fieldId)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

const saveRecent = (fieldId: string, option: ComboboxOption) => {
  try {
    const recents = getRecents(fieldId)
    // Remove if already exists
    const filtered = recents.filter(r => r.value !== option.value)
    // Add to beginning
    filtered.unshift(option)
    // Keep only MAX_RECENTS
    const limited = filtered.slice(0, MAX_RECENTS)
    localStorage.setItem(RECENTS_KEY_PREFIX + fieldId, JSON.stringify(limited))
  } catch {
    // Ignore storage errors
  }
}

interface ComboboxProps {
  options?: ComboboxOption[]
  value?: string
  onValueChange?: (value: string, label?: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  dropdownClassName?: string
  searchEndpoint?: string
  renderOption?: (option: any) => React.ReactNode
  autoFocus?: boolean
  recentFieldId?: string
  popularOptions?: ComboboxOption[]
  onCreateOption?: (inputValue: string) => Promise<void> | void
  createLabel?: string
}

export function Combobox({
  options: staticOptions = [],
  value,
  onValueChange,
  placeholder = "Buscar…",
  searchPlaceholder = "Buscar…",
  emptyMessage = "No se encontraron resultados.",
  className,
  dropdownClassName,
  searchEndpoint,
  renderOption,
  autoFocus = false,
  recentFieldId,
  popularOptions = [],
  onCreateOption,
  createLabel = "Usar",
}: ComboboxProps) {
  const [searchTerm, setSearchTerm] = React.useState("")
  const [isOpen, setIsOpen] = React.useState(false)
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)
  const [apiOptions, setApiOptions] = React.useState<ComboboxOption[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [isCreating, setIsCreating] = React.useState(false)
  const [selectedOption, setSelectedOption] = React.useState<ComboboxOption | null>(null)
  const [initialLabelLoaded, setInitialLabelLoaded] = React.useState(false)
  const [recentOptions, setRecentOptions] = React.useState<ComboboxOption[]>([])
  const [showRecents, setShowRecents] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLUListElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  
  // Load recents on mount (but don't show until focus)
  React.useEffect(() => {
    if (recentFieldId) {
      const recents = getRecents(recentFieldId)
      setRecentOptions(recents)
    }
  }, [recentFieldId])

  // Use API options if searchEndpoint is provided, otherwise use static options
  const options = searchEndpoint ? apiOptions : staticOptions

  // Load initial label if value exists but we don't have the label yet
  React.useEffect(() => {
    if (searchEndpoint && value && !selectedOption && !initialLabelLoaded) {
      // Fetch the label for the initial value
      const fetchInitialLabel = async () => {
        try {
          const response = await fetch(`${searchEndpoint}?q=${encodeURIComponent(value)}`)
          if (response.ok) {
            const data = await response.json()
            const found = data.find((opt: ComboboxOption) => opt.value === value)
            if (found) {
              setSelectedOption(found)
            }
          }
        } catch (error) {
          console.error('Error fetching initial label:', error)
        }
        setInitialLabelLoaded(true)
      }
      fetchInitialLabel()
    }
    // Reset if value becomes empty
    if (!value && selectedOption) {
      setSelectedOption(null)
      setInitialLabelLoaded(false)
    }
  }, [searchEndpoint, value, selectedOption, initialLabelLoaded])

  // Search API when user types (only if searchEndpoint is provided)
  React.useEffect(() => {
    if (!searchEndpoint || !searchTerm) {
      setApiOptions([])
      return
    }

    const searchApi = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(`${searchEndpoint}?q=${encodeURIComponent(searchTerm)}`)
        if (response.ok) {
          const data = await response.json()
          setApiOptions(data)
        }
      } catch (error) {
        console.error('Error searching:', error)
      } finally {
        setIsLoading(false)
      }
    }

    const debounce = setTimeout(searchApi, 150)
    return () => clearTimeout(debounce)
  }, [searchTerm, searchEndpoint])

  // Filtrar opciones basado en el término de búsqueda (solo para opciones estáticas)
  const filteredOptions = React.useMemo(() => {
    if (searchEndpoint) return options // Already filtered by API
    if (!searchTerm) return []
    return staticOptions.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [staticOptions, options, searchTerm, searchEndpoint])

  // Obtener la etiqueta seleccionada - usar selectedOption guardado
  const selectedLabel = React.useMemo(() => {
    if (selectedOption && selectedOption.value === value) {
      return selectedOption.label
    }
    if (!value) return ""
    const allOptions = searchEndpoint ? apiOptions : staticOptions
    const found = allOptions.find(option => option.value === value)
    return found?.label || ""
  }, [value, staticOptions, apiOptions, searchEndpoint, selectedOption])

  // Manejar creación de nueva opción
  const handleCreateOption = async () => {
    if (!onCreateOption || !searchTerm.trim() || isCreating) return
    setIsCreating(true)
    try {
      await onCreateOption(searchTerm.trim())
      setSearchTerm("")
      setIsOpen(false)
      setShowRecents(false)
    } finally {
      setIsCreating(false)
    }
  }

  // Manejar selección de opción
  const handleSelectOption = (option: ComboboxOption) => {
    setSelectedOption(option) // Guardar la opción seleccionada
    onValueChange?.(option.value, option.label)
    setSearchTerm("")
    setIsOpen(false)
    setShowRecents(false)
    inputRef.current?.blur()
    
    // Save to recents if field ID is provided
    if (recentFieldId) {
      saveRecent(recentFieldId, option)
      setRecentOptions(getRecents(recentFieldId))
    }
  }

  // Manejar cambio en el input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value
    setSearchTerm(newSearchTerm)
    
    // Solo abrir cuando hay al menos 1 caracter
    if (newSearchTerm.length >= 1) {
      setIsOpen(true)
      setShowRecents(false) // Ocultar recientes al escribir
    } else {
      setIsOpen(false)
      // Mostrar recientes si hay y el campo esta vacio
      if (recentFieldId && recentOptions.length > 0) {
        setShowRecents(true)
      }
    }
    setHighlightedIndex(0)
    
    // Si el input está vacío, limpiar la selección
    if (newSearchTerm === "" && value) {
      onValueChange?.("")
    }
  }

  // Manejar teclas
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" && searchTerm.length >= 1) {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        )
        break
      case "Enter":
        e.preventDefault()
        if (filteredOptions[highlightedIndex]) {
          handleSelectOption(filteredOptions[highlightedIndex])
        }
        break
      case "Escape":
        setIsOpen(false)
        setSearchTerm("")
        inputRef.current?.blur()
        break
    }
  }

  // Al hacer focus, mostrar dropdown con recientes y todas las opciones
  const handleInputFocus = async () => {
    if (!searchTerm) {
      setShowRecents(true)
      // Also load all options from API if using searchEndpoint
      if (searchEndpoint) {
        setIsLoading(true)
        try {
          const response = await fetch(`${searchEndpoint}?q=`)
          if (response.ok) {
            const data = await response.json()
            setApiOptions(data)
            
            // Filter out recents that no longer exist in database
            if (recentFieldId && recentOptions.length > 0) {
              const validRecents = recentOptions.filter(recent => 
                data.some((opt: ComboboxOption) => opt.value === recent.value)
              )
              if (validRecents.length !== recentOptions.length) {
                // Update localStorage with only valid recents
                localStorage.setItem(RECENTS_KEY_PREFIX + recentFieldId, JSON.stringify(validRecents))
                setRecentOptions(validRecents)
              }
            }
          }
        } catch (error) {
          console.error('Error loading options:', error)
        } finally {
          setIsLoading(false)
        }
      }
    }
  }

  // Cerrar al hacer clic fuera
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowRecents(false)
        setSearchTerm("")
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Scroll a la opción destacada
  React.useEffect(() => {
    if (listRef.current && isOpen) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ block: "nearest" })
      }
    }
  }, [highlightedIndex, isOpen])

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm || selectedLabel}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onClick={handleInputFocus}
          placeholder={value ? selectedLabel : searchPlaceholder}
          className={cn(
            "w-full h-field px-4 py-2 pr-10 border border-field rounded-control text-base",
            "focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100",
            "bg-white text-gray-900 placeholder:text-placeholder",
            className
          )}
          autoComplete="off"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
          <Search className="size-icon-md text-gray-700" />
        </div>
      </div>

      {/* Dropdown de recientes y todas las opciones */}
      {showRecents && !isOpen && (
        <ul
          className={cn("absolute z-toast w-full top-full mt-1 bg-white border border-field rounded-md shadow-float overflow-y-auto", dropdownClassName ?? "max-h-dropdown")}
        >
          {isLoading ? (
            <li className="px-4 py-2 text-gray-700 text-body">
              Cargando opciones...
            </li>
          ) : (
            <>
              {/* Sección de recientes */}
              {recentOptions.length > 0 && (
                <>
                  <li className="px-4 py-2 text-caption text-gray-700 font-medium sticky top-0 bg-white">
                    Recientes
                  </li>
                  {recentOptions.map((option) => (
                    <li
                      key={`recent-${option.value}`}
                      className={cn(
                        "flex items-center px-4 py-2 cursor-pointer text-body transition-colors",
                        "hover:bg-gray-100",
                        value === option.value && "font-medium bg-gray-100 text-gray-900"
                      )}
                      onClick={() => handleSelectOption(option)}
                    >
                      <Clock className="mr-2 size-icon-md flex-shrink-0 text-gray-700" />
                      <span className="truncate">{option.label}</span>
                    </li>
                  ))}
                </>
              )}
              
              {/* Sección de todas las opciones */}
              {(searchEndpoint ? apiOptions : staticOptions).length > 0 && (
                <>
                  <li className="px-4 py-2 text-caption text-gray-700 font-medium sticky top-0 bg-white">
                    Todas las opciones
                  </li>
                  {(searchEndpoint ? apiOptions : staticOptions)
                    .filter(opt => !recentOptions.some(r => r.value === opt.value))
                    .map((option) => (
                      <li
                        key={option.value}
                        className={cn(
                          "flex items-center px-4 py-2 cursor-pointer text-body transition-colors",
                          "hover:bg-gray-100",
                          value === option.value && "font-medium bg-gray-100 text-gray-900"
                        )}
                        onClick={() => handleSelectOption(option)}
                      >
                        <Check
                          className={cn(
                            "mr-2 size-icon-md flex-shrink-0",
                            value === option.value ? "opacity-100 text-gray-900" : "opacity-0"
                          )}
                        />
                        <span className="truncate">{option.label}</span>
                      </li>
                    ))}
                </>
              )}
              
              {/* Mensaje si no hay opciones */}
              {recentOptions.length === 0 && (searchEndpoint ? apiOptions : staticOptions).length === 0 && (
                <li className="px-4 py-2 text-gray-700 text-body">
                  No hay opciones disponibles
                </li>
              )}
            </>
          )}
        </ul>
      )}

      {isOpen && searchTerm.length >= 1 && (
        <ul
          ref={listRef}
          className={cn("absolute z-toast w-full top-full mt-1 bg-white border border-field rounded-md shadow-float overflow-y-auto", dropdownClassName ?? "max-h-dropdown")}
        >
          {isLoading ? (
            <li className="px-4 py-2 text-gray-700 text-body">
              Buscando...
            </li>
          ) : filteredOptions.length === 0 ? (
            <>
              {onCreateOption ? (
                <li
                  className="flex items-center gap-2 px-4 py-3 cursor-pointer text-body text-green-700 font-medium hover:bg-gray-50 transition-colors"
                  onClick={handleCreateOption}
                >
                  {isCreating ? (
                    <Spinner size="sm" className="flex-shrink-0 text-green-700" />
                  ) : (
                    <Plus className="size-icon-md flex-shrink-0" />
                  )}
                  <span className="truncate">{isCreating ? "Guardando…" : `${createLabel} "${searchTerm}"`}</span>
                </li>
              ) : (
                <li className="px-4 py-2 text-gray-700 text-body">
                  {emptyMessage}
                </li>
              )}
            </>
          ) : (
            filteredOptions.map((option, index) => {
              const parts = highlightMatch(option.label, searchTerm)
              return (
                <li
                  key={option.value}
                  className={cn(
                    "flex items-center px-4 py-2 cursor-pointer text-body transition-colors",
                    "hover:bg-gray-100",
                    index === highlightedIndex && "bg-gray-100",
                    value === option.value && "text-green-700 font-medium"
                  )}
                  onClick={() => handleSelectOption(option)}
                >
                  <Check
                    className={cn(
                      "mr-2 size-icon-md flex-shrink-0",
                      value === option.value ? "opacity-100 text-gray-900" : "opacity-0"
                    )}
                  />
                  {renderOption ? (
                    <div className="flex-1 truncate">{renderOption(option)}</div>
                  ) : (
                    <span className="text-gray-900 truncate">
                      {parts.map((part: string, i: number) => 
                        part.toLowerCase() === searchTerm.toLowerCase() 
                          ? <span key={i} className="bg-gray-200 font-semibold">{part}</span>
                          : <span key={i}>{part}</span>
                      )}
                    </span>
                  )}
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}