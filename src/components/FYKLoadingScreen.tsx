export function FYKLoadingScreen() {
	return (
		<div className="flex min-h-dvh flex-col items-center justify-center bg-background">
			<div className="flex flex-col items-center gap-6">
				<div className="animate-pulse">
					<h1 className="font-heading text-4xl font-bold tracking-tight text-foreground">
						FYK
					</h1>
					<p className="mt-1 text-center text-sm text-muted-foreground">
						Find Your King
					</p>
				</div>
				<div className="relative h-16 w-16">
					<div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
					<div
						className="absolute inset-2 rounded-full border-2 border-transparent border-b-purple-500 animate-spin"
						style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}
					/>
				</div>
				<p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
					Loading..
				</p>
			</div>
		</div>
	)
}
