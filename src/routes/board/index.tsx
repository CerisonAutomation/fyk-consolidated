import { createFileRoute } from "@tanstack/react-router";
import { BoardClient } from "../../components/board/board-client";

export const Route = createFileRoute("/board/")({
 component: BoardClient,
});
