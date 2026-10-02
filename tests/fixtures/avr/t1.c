#include "uart.h"
#include <stdlib.h>
#include <string.h>
#include <avr/pgmspace.h>
volatile uint8_t v8 = 200; volatile int16_t v16 = -12345; volatile uint32_t v32 = 3000000001UL; volatile float vf = 3.14159f;
static uint32_t crc32(const uint8_t *d, uint16_t n) { uint32_t c = 0xFFFFFFFF; while (n--) { c ^= *d++; for (uint8_t k = 0; k < 8; k++) c = (c >> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c; }
int cmp(const void *a, const void *b) { return *(const int16_t*)a - *(const int16_t*)b; }
const char msg[] PROGMEM = "flash string";
int main(void) {
  uart_init();
  printf("u8 %u %u %u\n", v8 * 3, v8 / 7, v8 % 13);
  printf("i16 %d %d %d %d\n", v16 * 3, v16 / 7, v16 % 13, v16 >> 3);
  printf("u32 %lu %lu %lu\n", v32 * 7, v32 / 1000, v32 % 997);
  int32_t s32 = -(int32_t)v32 / 3; printf("s32 %ld\n", s32);
  float f = vf * 2.5f + 1.0f / vf; printf("float %d %d\n", (int)(f * 1000), (int)(vf * vf * 10000));
  uint8_t buf[64]; for (uint8_t i = 0; i < 64; i++) buf[i] = i * 37 + 11;
  printf("crc %08lx\n", crc32(buf, 64));
  int16_t arr[20]; uint16_t seed = 7; for (uint8_t i = 0; i < 20; i++) { seed = seed * 25173 + 13849; arr[i] = (int16_t)seed % 1000; }
  qsort(arr, 20, sizeof arr[0], cmp); for (uint8_t i = 0; i < 20; i++) printf("%d ", arr[i]); printf("\n");
  char t[32]; strcpy_P(t, msg); printf("%s %u\n", t, (unsigned)strlen(t));
  uint16_t fib[24]; fib[0] = 0; fib[1] = 1; for (uint8_t i = 2; i < 24; i++) fib[i] = fib[i-1] + fib[i-2]; printf("fib %u\n", fib[23]);
  printf("done\n");
  finish();
}
