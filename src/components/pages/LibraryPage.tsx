export function LibraryPage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Library</h1>
      <div className="space-y-4">
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-medium mb-2">Your Content</h2>
          <p className="text-muted-foreground">
            Access your saved sleep sessions and audio content.
          </p>
        </div>
      </div>
    </div>
  )
}
