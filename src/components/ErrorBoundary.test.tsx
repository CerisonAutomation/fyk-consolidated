import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "./ErrorBoundary";

// Component that throws on render
function ThrowingComponent({ message }: { message?: string }) {
	throw new Error(message ?? "Test error");
}

// Component that renders normally
function NormalComponent() {
	return <div>Normal content</div>;
}

describe("ErrorBoundary", () => {
	it("renders children when no error", () => {
		render(
			<ErrorBoundary>
				<NormalComponent />
			</ErrorBoundary>,
		);
		expect(screen.getByText("Normal content")).toBeInTheDocument();
	});

	it("renders default fallback when child throws", () => {
		render(
			<ErrorBoundary>
				<ThrowingComponent />
			</ErrorBoundary>,
		);
		expect(screen.getByRole("alert")).toBeInTheDocument();
		expect(screen.getByText("Something went wrong")).toBeInTheDocument();
	});

	it("displays the error message", () => {
		render(
			<ErrorBoundary>
				<ThrowingComponent message="Custom error message" />
			</ErrorBoundary>,
		);
		expect(screen.getByText("Custom error message")).toBeInTheDocument();
	});

	it("renders custom fallback when provided", () => {
		render(
			<ErrorBoundary fallback={<div>Custom fallback</div>}>
				<ThrowingComponent />
			</ErrorBoundary>,
		);
		expect(screen.getByText("Custom fallback")).toBeInTheDocument();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("calls onError when error is caught", () => {
		const onError = vi.fn();
		render(
			<ErrorBoundary onError={onError}>
				<ThrowingComponent message="observed error" />
			</ErrorBoundary>,
		);
		expect(onError).toHaveBeenCalledTimes(1);
		expect(onError).toHaveBeenCalledWith(
			expect.objectContaining({ message: "observed error" }),
			expect.objectContaining({ componentStack: expect.any(String) }),
		);
	});

	it("shows retry button", () => {
		render(
			<ErrorBoundary>
				<ThrowingComponent />
			</ErrorBoundary>,
		);
		expect(
			screen.getByRole("button", { name: /try again/i }),
		).toBeInTheDocument();
	});

	it("retry button resets error state", () => {
		// We need a component that can toggle between throwing and not
		let shouldThrow = true;
		function ToggleComponent() {
			if (shouldThrow) throw new Error("toggle error");
			return <div>Recovered</div>;
		}

		render(
			<ErrorBoundary>
				<ToggleComponent />
			</ErrorBoundary>,
		);

		expect(screen.getByText("Something went wrong")).toBeInTheDocument();

		// Fix the error condition
		shouldThrow = false;

		// Click retry
		fireEvent.click(screen.getByRole("button", { name: /try again/i }));

		// Children should render again
		expect(screen.getByText("Recovered")).toBeInTheDocument();
	});
});
