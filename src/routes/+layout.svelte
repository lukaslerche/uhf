<script lang="ts">
	import '@picocss/pico';
    let { children } = $props();
</script>

<div class="container">
	<header>
       
		<h1>RFID UHF tag formats for libraries</h1>
		<p>
			as supported by <a href="https://www.bookwaves.de" target="_blank">BookWaves</a>
		</p>
	</header>

	{@render children()}

	<footer>
		<hr />
		<div class="footer-content">
			<p>
				<a
					href="https://github.com/lukaslerche/uhf"
					target="_blank"
					rel="noopener noreferrer"
				>
					GitHub Repository
				</a>
			</p>
			<p>
				Built with <a href="https://kit.svelte.dev/" target="_blank" rel="noopener noreferrer"
					>SvelteKit</a
				>
				and <a href="https://picocss.com/" target="_blank" rel="noopener noreferrer">Pico CSS</a>
			</p>
		</div>
	</footer>
</div>

<style>
	header {
		padding: 2rem 0;
		text-align: center;
	}

	h1 {
		margin-bottom: 0.5rem;
	}

	footer {
		margin-top: 3rem;
		padding-bottom: 2rem;
	}

	.footer-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
	}

	@media (max-width: 576px) {
		.footer-content {
			flex-direction: column;
			text-align: center;
		}
	}
</style>