"""Original procedural music. No recordings, samples, or third-party melody."""
from pathlib import Path
import wave
import numpy as np

SR = 44100
OUT = Path('public/audio/en-v2')
OUT.mkdir(parents=True, exist_ok=True)

def frequency(midi):
    return 440 * 2 ** ((midi - 69) / 12)

def compose(seconds, bpm, energetic, name):
    rng = np.random.default_rng(260611 + int(energetic))
    mix = np.zeros((int(seconds * SR), 2), dtype=np.float32)
    beat = 60 / bpm
    def place(time, sound, gain, pan=0):
        begin = int(time * SR)
        if begin >= len(mix): return
        count = min(len(sound), len(mix) - begin)
        if count <= 0: return
        gains = np.array([np.sqrt((1-pan)/2), np.sqrt((1+pan)/2)], dtype=np.float32)
        mix[begin:begin+count] += sound[:count, None] * gains * gain
    def key(note, length=1.5):
        t = np.arange(int(length * SR), dtype=np.float32) / SR
        f = frequency(note)
        tone = np.sin(2*np.pi*f*t + 1.5*np.sin(4*np.pi*f*t)*np.exp(-5*t))
        tone += .13*np.sin(6*np.pi*f*t)*np.exp(-4*t)
        return tone * (1-np.exp(-180*t)) * np.exp(-2.5*t) * np.minimum(1,(length-t)*14)
    def bass(note):
        t = np.arange(int(beat*.78*SR), dtype=np.float32) / SR
        f = frequency(note)
        return (np.sin(2*np.pi*f*t)+.12*np.sin(4*np.pi*f*t))*(1-np.exp(-150*t))*np.exp(-6*t)*np.minimum(1,(beat*.78-t)*28)
    def kick():
        t = np.arange(int(.32*SR), dtype=np.float32) / SR
        phase = 2*np.pi*(46*t + 6*(1-np.exp(-35*t)))
        return np.sin(phase)*np.exp(-19*t) + .08*rng.normal(size=len(t))*np.exp(-160*t)
    def hat():
        t = np.arange(int(.095*SR), dtype=np.float32) / SR
        white = rng.normal(size=len(t))
        high = white - np.convolve(white, np.ones(9)/9, mode='same')
        return high*np.exp(-70*t)*(1-np.exp(-700*t))
    def snare():
        t = np.arange(int(.18*SR), dtype=np.float32) / SR
        white = rng.normal(size=len(t))
        high = white - np.convolve(white, np.ones(17)/17, mode='same')
        return high*np.exp(-28*t)*.45 + .35*np.sin(2*np.pi*175*t)*np.exp(-35*t)
    chords = [[50,57,60,64,69],[46,53,57,60,65],[53,60,64,67,72],[48,55,58,62,67]]
    roots = [38,34,41,36]
    bars = int(np.ceil(seconds/(4*beat)))
    for bar in range(bars):
        start = bar*4*beat
        chord = chords[(bar//2)%4]
        root = roots[(bar//2)%4]
        for note_index,note in enumerate(chord):
            place(start+.012*note_index, key(note,2.25), .13 if energetic else .10, -.6+note_index*.3)
            if energetic: place(start+2.5*beat+.01*note_index,key(note,1.1),.065,-.5+note_index*.25)
        for k in range(4):
            if energetic or k in [0,2]: place(start+k*beat,kick(),.48 if energetic else .28)
            place(start+k*beat,bass(root+(12 if k==3 and bar%2 else 0)),.30 if energetic else .16)
            if k in [1,3]: place(start+k*beat,snare(),.17 if energetic else .075,.10)
        for k in range(8):
            place(start+k*.5*beat,hat(),(.042 if k%2==0 else .024)*(1 if energetic else .55),(-1 if k%2 else 1)*.52)
        melody=[74,69,72,77,76,72,69,65]
        for k in range(4 if energetic else 2):
            offset = (.5+k*.75)*beat if energetic else (1+k*2)*beat
            place(start+offset,key(melody[(bar*2+k)%len(melody)],1.1),.105 if energetic else .052,(-1 if k%2 else 1)*.4)
    # A short stereo delay adds space without a recording or reverb sample.
    dry=mix.copy()
    delay=int(beat*.75*SR)
    mix[delay:,0] += dry[:-delay,1]*.14
    mix[delay:,1] += dry[:-delay,0]*.14
    fade_in=np.minimum(1,np.arange(len(mix))/(SR*.06))
    fade_out=np.minimum(1,(len(mix)-np.arange(len(mix)))/(SR*.8))
    mix *= (fade_in*fade_out)[:,None]
    # Retain transient headroom; final voice/music ducking is authored in Remotion.
    peak=float(np.max(np.abs(mix)))
    mix *= .72/max(peak,.001)
    with wave.open(str(OUT/name),'wb') as f:
        f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR)
        f.writeframes((np.clip(mix,-1,1)*32767).astype('<i2').tobytes())
    print(name, seconds, 's; peak',float(np.max(np.abs(mix))))

compose(26,120,True,'presentation-score.wav')
compose(180,96,False,'tutorial-score.wav')
