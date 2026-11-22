import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function submitLecture() {
  render(<HomePage />);
  fireEvent.change(screen.getByRole("textbox", { name: "YouTube video URL" }), {
    target: { value: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Generate Study Notes" }));
}

describe("lecture generation stream", () => {
  it("offers a retry when the stream ends after a progress event", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      'data: {"type":"progress","stage":"Retrieving transcript","stageIndex":3}\n\n',
    )));

    submitLecture();

    expect(await screen.findByText(/connection ended before generation finished/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeTruthy();
  });

  it("shows an HTTP error even when the response has a body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      "Service unavailable",
      { status: 503 },
    )));

    submitLecture();

    expect(await screen.findByText("Server error (503)")).toBeTruthy();
  });
});
