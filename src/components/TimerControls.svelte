<script lang="ts">
  import type { TimerStatus } from "../lib/config";

  let {
    ready,
    status,
    onStart,
    onPause,
    onResume,
    onSkip,
    onReset,
  }: {
    ready: boolean;
    status: TimerStatus;
    onStart: () => void;
    onPause: () => void;
    onResume: () => void;
    onSkip: () => void;
    onReset: () => void;
  } = $props();
</script>

<div class="controls">
  {#if status === "idle"}
    <button
      class="primary-button"
      type="button"
      onclick={onStart}
      disabled={!ready}
    >
      Start
    </button>
  {:else if status === "running"}
    <button
      class="primary-button"
      type="button"
      onclick={onPause}
      disabled={!ready}
    >
      Pause
    </button>
  {:else}
    <button
      class="primary-button"
      type="button"
      onclick={onResume}
      disabled={!ready}
    >
      Resume
    </button>
  {/if}

  <button
    class="secondary-button"
    type="button"
    onclick={onSkip}
    disabled={!ready || status === "idle"}
  >
    Skip
  </button>
  <button
    class="secondary-button"
    type="button"
    onclick={onReset}
    disabled={!ready}
  >
    Reset
  </button>
</div>
