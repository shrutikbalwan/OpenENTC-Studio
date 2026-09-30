"""Bounded JSON-lines numerical worker.

Only allow-listed numerical operations are accepted. Project files and Python
source are data here; nothing is imported or evaluated.
"""
import json
import math
import sys

MAX_LINE_BYTES = 2 * 1024 * 1024
MAX_SAMPLES = 100_000
MAX_N2_OPERATIONS = 25_000_000


def finite(value, name):
    if not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{name} must be finite")
    return float(value)


def samples(value):
    if not isinstance(value, list) or not value or len(value) > MAX_SAMPLES:
        raise ValueError("samples must be a non-empty bounded list")
    return [finite(item, "sample") for item in value]


def windowed(values, name):
    if name not in ("hann", "hamming", "rectangular"):
        raise ValueError("window must be hann, hamming, or rectangular")
    if name == "rectangular":
        return values
    denominator = max(1, len(values) - 1)
    return [value * ((0.5 - 0.5 * math.cos(2 * math.pi * index / denominator)) if name == "hann" else (0.54 - 0.46 * math.cos(2 * math.pi * index / denominator))) for index, value in enumerate(values)]


def run(request):
    if not isinstance(request, dict) or not isinstance(request.get("id"), str):
        raise ValueError("request id is required")
    operation = request.get("operation")
    args = request.get("args", {})
    if not isinstance(args, dict):
        raise ValueError("args must be an object")
    if operation == "generate_sine":
        length = args.get("length")
        if not isinstance(length, int) or length < 1 or length > MAX_SAMPLES:
            raise ValueError("length is outside the allowed range")
        frequency = finite(args.get("frequency"), "frequency")
        sample_rate = finite(args.get("sampleRate"), "sampleRate")
        amplitude = finite(args.get("amplitude", 1), "amplitude")
        phase = finite(args.get("phase", 0), "phase")
        offset = finite(args.get("offset", 0), "offset")
        if sample_rate <= 0:
            raise ValueError("sampleRate must be positive")
        data = [offset + amplitude * math.sin(2 * math.pi * frequency * i / sample_rate + phase) for i in range(length)]
        return {"kind": "time-series", "data": data, "sampleRate": sample_rate, "units": args.get("units", "1")}
    if operation == "convolve":
        first = samples(args.get("input"))
        second = samples(args.get("kernel"))
        if len(first) + len(second) - 1 > MAX_SAMPLES:
            raise ValueError("convolution output exceeds the sample limit")
        if len(first) * len(second) > MAX_N2_OPERATIONS:
            raise ValueError("convolution workload exceeds the computation limit")
        data = [0.0] * (len(first) + len(second) - 1)
        for i, left in enumerate(first):
            for j, right in enumerate(second):
                data[i + j] += left * right
        return {"kind": "array", "data": data}
    if operation == "fft":
        values = samples(args.get("input"))
        if len(values) > 4096:
            raise ValueError("FFT input exceeds the limit")
        real, imaginary = [], []
        for k in range(len(values)):
            real.append(sum(value * math.cos(-2 * math.pi * k * n / len(values)) for n, value in enumerate(values)))
            imaginary.append(sum(value * math.sin(-2 * math.pi * k * n / len(values)) for n, value in enumerate(values)))
        return {"kind": "spectrum", "real": real, "imaginary": imaginary, "sampleRate": finite(args.get("sampleRate", 1), "sampleRate"), "units": args.get("units", "1")}
    if operation == "window":
        values = samples(args.get("input"))
        return {"kind": "array", "data": windowed(values, args.get("window", "hann"))}
    if operation == "correlate":
        first = samples(args.get("input"))
        second = samples(args.get("reference"))
        if len(first) + len(second) - 1 > MAX_SAMPLES:
            raise ValueError("correlation output exceeds the sample limit")
        if len(first) * len(second) > MAX_N2_OPERATIONS:
            raise ValueError("correlation workload exceeds the computation limit")
        data = []
        for lag in range(-(len(second) - 1), len(first)):
            data.append(sum(first[index] * second[index - lag] for index in range(len(first)) if 0 <= index - lag < len(second)))
        return {"kind": "array", "data": data, "lagStart": -(len(second) - 1)}
    if operation == "resample":
        values = samples(args.get("input"))
        source_rate = finite(args.get("sampleRate"), "sampleRate")
        target_rate = finite(args.get("targetSampleRate"), "targetSampleRate")
        if source_rate <= 0 or target_rate <= 0:
            raise ValueError("sample rates must be positive")
        output_length = max(1, round(len(values) * target_rate / source_rate))
        if output_length > MAX_SAMPLES:
            raise ValueError("resample output exceeds the sample limit")
        data = []
        for index in range(output_length):
            position = index * source_rate / target_rate
            left = min(len(values) - 1, int(position))
            right = min(len(values) - 1, left + 1)
            fraction = position - left
            data.append(values[left] + (values[right] - values[left]) * fraction)
        return {"kind": "time-series", "data": data, "sampleRate": target_rate, "units": args.get("units", "1")}
    if operation == "fir_filter":
        values = samples(args.get("input"))
        coefficients = samples(args.get("coefficients"))
        if len(coefficients) > 4096:
            raise ValueError("FIR coefficients exceed the limit")
        if len(values) * len(coefficients) > MAX_N2_OPERATIONS:
            raise ValueError("FIR workload exceeds the computation limit")
        data = []
        for index in range(len(values)):
            data.append(sum(values[index - tap] * coefficients[tap] for tap in range(min(index, len(coefficients) - 1) + 1)))
        return {"kind": "time-series", "data": data, "sampleRate": finite(args.get("sampleRate", 1), "sampleRate"), "units": args.get("units", "1")}
    raise ValueError("operation is not supported")


for line in sys.stdin:
    if len(line.encode("utf-8")) > MAX_LINE_BYTES:
        response = {"id": None, "ok": False, "error": {"code": "INPUT_TOO_LARGE", "message": "request exceeds the byte limit"}}
    else:
        request = None
        try:
            request = json.loads(line)
            response = {"id": request.get("id") if isinstance(request, dict) else None, "ok": True, "result": run(request)}
        except (ValueError, TypeError, json.JSONDecodeError) as error:
            response = {"id": request.get("id") if isinstance(request, dict) else None, "ok": False, "error": {"code": "INPUT_INVALID", "message": str(error)}}
    sys.stdout.write(json.dumps(response, separators=(",", ":")) + "\n")
    sys.stdout.flush()
