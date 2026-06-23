<script lang="ts">
  import type { TimerStatus } from "../lib/config";

  let {
    status,
    onStart,
    onPause,
    onResume,
    onSkip,
    onReset,
  }: {
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
    >
      Start
    </button>
  {:else if status === "running"}
    <button
      class="primary-button"
      type="button"
      onclick={onPause}
    >
      Pause
    </button>
  {:else}
    <button
      class="primary-button"
      type="button"
      onclick={onResume}
    >
      Resume
    </button>
  {/if}

  <button
    class="secondary-button"
    type="button"
    onclick={onSkip}
    disabled={status === "idle"}
  >
    Skip
  </button>
  <button
    class="secondary-button"
    type="button"
    onclick={onReset}
  >
    Reset
  </button>
</div>
