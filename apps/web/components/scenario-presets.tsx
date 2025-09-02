'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Save, FolderOpen, Trash2, Star } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface ValuationInputs {
  ebitda: number
  net_debt: number
  maintenance_capex: number
  tax_rate: number
  reinvestment_rate: number
  risk_free_rate: number
  market_risk_premium: number
  beta: number
  cost_of_debt: number
  debt_weight: number
  equity_weight: number
}

interface ScenarioPreset {
  id: string
  name: string
  description: string
  inputs: ValuationInputs
  createdAt: string
  isFavorite?: boolean
}

interface ScenarioPresetsProps {
  currentInputs: ValuationInputs
  onLoadPreset: (inputs: ValuationInputs) => void
  onSavePreset?: (preset: ScenarioPreset) => void
}

export function ScenarioPresets({ currentInputs, onLoadPreset, onSavePreset }: ScenarioPresetsProps) {
  const [presets, setPresets] = useState<ScenarioPreset[]>([])
  const [newPresetName, setNewPresetName] = useState('')
  const [newPresetDescription, setNewPresetDescription] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const { toast } = useToast()

  // Load presets from localStorage on mount (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const savedPresets = localStorage.getItem('energy-ic-scenario-presets')
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets))
      } catch (error) {
        console.error('Failed to load scenario presets:', error)
      }
    }
  }, [])

  // Save presets to localStorage whenever presets change (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('energy-ic-scenario-presets', JSON.stringify(presets))
  }, [presets])

  const handleSavePreset = () => {
    if (!newPresetName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name for the scenario preset",
        variant: "destructive",
      })
      return
    }

    const newPreset: ScenarioPreset = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      description: newPresetDescription.trim() || 'No description',
      inputs: { ...currentInputs },
      createdAt: new Date().toISOString(),
      isFavorite: false
    }

    const updatedPresets = [...presets, newPreset]
    setPresets(updatedPresets)
    setNewPresetName('')
    setNewPresetDescription('')
    setShowSaveDialog(false)

    toast({
      title: "Scenario Saved",
      description: `"${newPreset.name}" has been saved successfully`,
      variant: "success",
    })

    onSavePreset?.(newPreset)
  }

  const handleLoadPreset = (preset: ScenarioPreset) => {
    onLoadPreset(preset.inputs)
    toast({
      title: "Scenario Loaded",
      description: `"${preset.name}" has been loaded`,
      variant: "success",
    })
  }

  const handleDeletePreset = (presetId: string) => {
    const updatedPresets = presets.filter(p => p.id !== presetId)
    setPresets(updatedPresets)
    toast({
      title: "Scenario Deleted",
      description: "The scenario preset has been removed",
      variant: "success",
    })
  }

  const toggleFavorite = (presetId: string) => {
    const updatedPresets = presets.map(p =>
      p.id === presetId ? { ...p, isFavorite: !p.isFavorite } : p
    )
    setPresets(updatedPresets)
  }

  const favoritePresets = presets.filter(p => p.isFavorite)
  const regularPresets = presets.filter(p => !p.isFavorite)

  // Default scenario presets
  const defaultPresets: ScenarioPreset[] = [
    {
      id: 'default-base',
      name: 'Base Case',
      description: 'Standard valuation assumptions',
      inputs: {
        ebitda: 3450,
        net_debt: 18750,
        maintenance_capex: 220,
        tax_rate: 0.25,
        reinvestment_rate: 0.15,
        risk_free_rate: 0.04,
        market_risk_premium: 0.06,
        beta: 0.8,
        cost_of_debt: 0.05,
        debt_weight: 0.4,
        equity_weight: 0.6
      },
      createdAt: new Date().toISOString(),
      isFavorite: true
    },
    {
      id: 'default-bull',
      name: 'Bull Case',
      description: 'Optimistic scenario with higher growth',
      inputs: {
        ebitda: 3450,
        net_debt: 18750,
        maintenance_capex: 220,
        tax_rate: 0.25,
        reinvestment_rate: 0.12,
        risk_free_rate: 0.04,
        market_risk_premium: 0.06,
        beta: 0.7,
        cost_of_debt: 0.045,
        debt_weight: 0.35,
        equity_weight: 0.65
      },
      createdAt: new Date().toISOString(),
      isFavorite: true
    },
    {
      id: 'default-bear',
      name: 'Bear Case',
      description: 'Conservative scenario with higher risk',
      inputs: {
        ebitda: 3450,
        net_debt: 18750,
        maintenance_capex: 220,
        tax_rate: 0.25,
        reinvestment_rate: 0.18,
        risk_free_rate: 0.06,
        market_risk_premium: 0.08,
        beta: 1.0,
        cost_of_debt: 0.06,
        debt_weight: 0.45,
        equity_weight: 0.55
      },
      createdAt: new Date().toISOString(),
      isFavorite: true
    }
  ]

  // Initialize default presets if none exist (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined' || presets.length > 0) return

    const savedDefaults = localStorage.getItem('energy-ic-default-presets-loaded')
    if (!savedDefaults) {
      setPresets(defaultPresets)
      localStorage.setItem('energy-ic-default-presets-loaded', 'true')
    }
  }, [presets.length])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Save className="w-5 h-5" />
          Scenario Presets
        </CardTitle>
        <CardDescription>
          Save and load different valuation scenarios for quick analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Save Current Scenario */}
        <div className="mb-6">
          {!showSaveDialog ? (
            <Button onClick={() => setShowSaveDialog(true)} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              Save Current Scenario
            </Button>
          ) : (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <div>
                <label className="text-sm font-medium mb-2 block">Scenario Name</label>
                                  <Input
                    value={newPresetName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPresetName(e.target.value)}
                    placeholder="Enter scenario name..."
                    className="w-full"
                  />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Description (Optional)</label>
                <Input
                  value={newPresetDescription}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPresetDescription(e.target.value)}
                  placeholder="Describe this scenario..."
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSavePreset} size="sm">
                  Save
                </Button>
                <Button
                  onClick={() => setShowSaveDialog(false)}
                  variant="outline"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Favorite Presets */}
        {favoritePresets.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              Favorite Scenarios
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {favoritePresets.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  onLoad={() => handleLoadPreset(preset)}
                  onDelete={() => handleDeletePreset(preset.id)}
                  onToggleFavorite={() => toggleFavorite(preset.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* All Presets */}
        <div>
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            All Scenarios ({presets.length})
          </h3>
          {presets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No scenario presets saved yet. Save your first scenario above.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {regularPresets.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  onLoad={() => handleLoadPreset(preset)}
                  onDelete={() => handleDeletePreset(preset.id)}
                  onToggleFavorite={() => toggleFavorite(preset.id)}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface PresetCardProps {
  preset: ScenarioPreset
  onLoad: () => void
  onDelete: () => void
  onToggleFavorite: () => void
}

function PresetCard({ preset, onLoad, onDelete, onToggleFavorite }: PresetCardProps) {
  return (
    <div className="p-4 border rounded-lg hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h4 className="font-medium text-sm">{preset.name}</h4>
          <p className="text-xs text-muted-foreground mt-1">{preset.description}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleFavorite}
          className="ml-2"
        >
          <Star
            className={`w-4 h-4 ${preset.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`}
          />
        </Button>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="text-xs text-muted-foreground">
          {new Date(preset.createdAt).toLocaleDateString()}
        </div>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={onLoad}>
            Load
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}
