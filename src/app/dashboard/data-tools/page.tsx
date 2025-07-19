'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { summarizeDataRequest } from '@/ai/flows/summarize-data-request';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Lock } from 'lucide-react';

export default function DataToolsPage() {
  const { user } = useAuth();
  const [dataDescription, setDataDescription] = useState('Weekly sales figures for all product categories.');
  const [dataToSummarize, setDataToSummarize] = useState('Electronics: $15,200, Furniture: $8,500, Groceries: $12,100, Sports: $5,400');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  const hasAccess = user?.role === 'admin';

  const handleSummarize = async () => {
    if (!dataToSummarize.trim() || !dataDescription.trim()) return;
    setLoading(true);
    setSummary('');
    try {
      const result = await summarizeDataRequest({ dataDescription, data: dataToSummarize });
      setSummary(result.summary);
    } catch (error) {
      setSummary('Failed to generate summary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!hasAccess) {
    return (
        <div className="flex h-full items-center justify-center">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle className="flex items-center justify-center gap-2"><Lock /> Access Denied</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>This feature is only available to Admin roles.</p>
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">AI Data Preparation Tool</h1>
      <Card>
        <CardHeader>
          <CardTitle>Data Summarizer</CardTitle>
          <CardDescription>Provide data and a description, and the AI will generate a summary.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="data-description">Data Description</Label>
            <Input 
              id="data-description" 
              value={dataDescription} 
              onChange={(e) => setDataDescription(e.target.value)}
              placeholder="e.g., Monthly user sign-up data"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="data-to-summarize">Data</Label>
            <Textarea 
              id="data-to-summarize" 
              value={dataToSummarize} 
              onChange={(e) => setDataToSummarize(e.target.value)}
              placeholder="Paste your data here..."
              rows={10}
            />
          </div>
          <Button onClick={handleSummarize} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Summarize Data
          </Button>
        </CardContent>
      </Card>
      
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>AI Generated Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{summary}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
