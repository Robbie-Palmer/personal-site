"use client";

import { Fragment, Slide, type SlideProps } from "@revealjs/react";

export function PitchSlide({
  children,
  className,
  ...props
}: Readonly<SlideProps>) {
  return (
    <Slide className={`pitch-slide ${className ?? ""}`.trim()} {...props}>
      <div className="pitch-slide__content">{children}</div>
    </Slide>
  );
}

export function PitchStep({
  children,
  index,
}: Readonly<{ children: React.ReactNode; index?: number }>) {
  return (
    <Fragment as="div" animation="fade-up" className="pitch-step" index={index}>
      {children}
    </Fragment>
  );
}

export function PitchNotes({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <aside className="notes">{children}</aside>;
}

export function PitchColumns({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="pitch-columns">{children}</div>;
}

export function PitchColumn({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="pitch-column">{children}</div>;
}
