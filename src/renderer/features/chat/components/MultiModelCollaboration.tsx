/**
 * Multi-Model Collaboration Component
 * Allows users to run multiple LLMs simultaneously and compare/combine results
 */

import { useState } from 'react'
import { Message } from '@/types'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Loader2, Sparkles, CheckCircle2, XCircle } from 'lucide-react'
import { ResponsiveContainer } from '@/components/responsive/ResponsiveContainer'

interface MultiModelCollaborationProps {
    messages: Message[]
    onResult?: (result: string) => void
    availableModels?: Array<{ provider: string; model: string; label: string }>
}

type Strategy = 'consensus' | 'voting' | 'best-of-n' | 'chain-of-thought'

export function MultiModelCollaboration({
    messages,
    onResult,
    availableModels = []
}: MultiModelCollaborationProps) {
    const [selectedModels, setSelectedModels] = useState<Array<{ provider: string; model: string }>>([])
    const [strategy, setStrategy] = useState<Strategy>('consensus')
    const [isRunning, setIsRunning] = useState(false)
    const [results, setResults] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)

    const handleAddModel = () => {
        if (availableModels.length > 0) {
            const firstModel = availableModels[0]
            setSelectedModels([...selectedModels, {
                provider: firstModel.provider,
                model: firstModel.model
            }])
        }
    }

    const handleRemoveModel = (index: number) => {
        setSelectedModels(selectedModels.filter((_, i) => i !== index))
    }

    const handleRun = async () => {
        if (selectedModels.length === 0) {
            setError('Please select at least one model')
            return
        }

        setIsRunning(true)
        setError(null)
        setResults(null)

        try {
            const result = await window.electron.collaboration.run({
                messages,
                models: selectedModels,
                strategy
            })

            setResults(result)
            // Use the main response field from the result
            if (result.response) {
                onResult?.(result.response)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to run collaboration')
        } finally {
            setIsRunning(false)
        }
    }

    return (
        <ResponsiveContainer className="w-full space-y-4">
            <Card className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">Multi-Model Collaboration</h3>
                </div>

                {/* Model Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Selected Models</label>
                    {selectedModels.map((model, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                            <span className="flex-1 text-sm">
                                {model.provider}/{model.model}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveModel(index)}
                                disabled={isRunning}
                            >
                                Remove
                            </Button>
                        </div>
                    ))}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddModel}
                        disabled={isRunning || availableModels.length === 0}
                    >
                        Add Model
                    </Button>
                </div>

                {/* Strategy Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Collaboration Strategy</label>
                    <Select
                        value={strategy}
                        onValueChange={(value) => setStrategy(value as Strategy)}
                        disabled={isRunning}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="consensus">Consensus (Find Common Themes)</SelectItem>
                            <SelectItem value="vote">Vote (Majority Wins)</SelectItem>
                            <SelectItem value="best-of-n">Best of N (Quality Score)</SelectItem>
                            <SelectItem value="chain-of-thought">Chain of Thought (Sequential Refinement)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Run Button */}
                <Button
                    onClick={handleRun}
                    disabled={isRunning || selectedModels.length === 0}
                    className="w-full"
                >
                    {isRunning ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Running Collaboration...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            Run Collaboration
                        </>
                    )}
                </Button>

                {/* Error Display */}
                {error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-destructive" />
                        <span className="text-sm text-destructive">{error}</span>
                    </div>
                )}

                {/* Results Display */}
                {results && (
                    <div className="space-y-4 mt-4 pt-4 border-t">
                        <h4 className="font-semibold">Results</h4>
                        
                        {/* Individual Responses */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Individual Responses</label>
                            {results.responses.map((response: any, index: number) => (
                                <Card key={index} className="p-3">
                                    <div className="flex items-start justify-between mb-2">
                                        <span className="text-sm font-medium">
                                            {response.provider}/{response.model}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {response.latency}ms
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-3">
                                        {response.content}
                                    </p>
                                </Card>
                            ))}
                        </div>

                        {/* Consensus/Best Response */}
                        {(results.consensus || results.bestResponse) && (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Final Result</label>
                                <Card className="p-4 bg-primary/5">
                                    {results.consensus && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <CheckCircle2 className="w-4 h-4 text-primary" />
                                                <span className="text-sm font-medium">Consensus</span>
                                            </div>
                                            <p className="text-sm">{results.consensus}</p>
                                        </div>
                                    )}
                                    {results.bestResponse && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <CheckCircle2 className="w-4 h-4 text-primary" />
                                                <span className="text-sm font-medium">Best Response</span>
                                            </div>
                                            <p className="text-sm mb-2">{results.bestResponse.content}</p>
                                            <p className="text-xs text-muted-foreground">
                                                From: {results.bestResponse.provider}/{results.bestResponse.model}
                                            </p>
                                        </div>
                                    )}
                                </Card>
                            </div>
                        )}
                    </div>
                )}
            </Card>
        </ResponsiveContainer>
    )
}
