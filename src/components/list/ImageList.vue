<script setup lang="ts">
import { useImagesStore } from '../../stores/images'
import ImageCard from './ImageCard.vue'

const images = useImagesStore()
</script>

<template>
  <div class="space-y-1 overflow-y-auto">
    <ImageCard
      v-for="asset in images.assets"
      :key="asset.id"
      :asset="asset"
      :active="asset.id === images.selectedId"
      :disabled="images.batch.active"
      @select="images.selectedId = asset.id"
      @remove="images.remove(asset.id)"
    />
  </div>
</template>
