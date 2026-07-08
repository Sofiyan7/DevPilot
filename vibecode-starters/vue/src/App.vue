<template>
  <div style="text-align: center; padding: 2rem; font-family: sans-serif;">
    <h1>DevPilot Vue App</h1>
    <button @click="count++">Count: {{ count }}</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
const count = ref(0)
</script>