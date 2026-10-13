import React from 'react'

// The accent colours glowing behind the whole app.
// On larger screens they are slow moving blurred blobs. A phone gets the same glow as a still
// gradient: moving a blur that size every frame is what makes scrolling stutter there
const Aurora = () => (
  <div aria-hidden='true' className='pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas'>
    <div className='absolute inset-0 opacity-[var(--aurora-opacity)] max-md:hidden'>
      <div className='absolute -top-[20%] -left-[10%] w-[55vw] h-[55vw] rounded-full bg-[var(--a1)] blur-[130px] animate-drift-a' />
      <div className='absolute top-[20%] -right-[15%] w-[50vw] h-[50vw] rounded-full bg-[var(--a3)] blur-[140px] animate-drift-b' />
      <div className='absolute -bottom-[30%] left-[25%] w-[52vw] h-[52vw] rounded-full bg-[var(--a2)] blur-[150px] animate-drift-c' />
    </div>
    <div className='aurora-still absolute inset-0 opacity-[var(--aurora-opacity)] md:hidden' />
    {/* darkens the middle so text on glass stays readable */}
    <div className='absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--canvas)_55%,transparent),color-mix(in_oklab,var(--canvas)_20%,transparent)_70%)]' />
  </div>
)

export default Aurora
