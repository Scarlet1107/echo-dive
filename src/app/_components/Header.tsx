"use client";
import Link from 'next/link';
import React from 'react'

const Header = () => {
    return (
        <header className="w-full flex justify-between items-center p-4 px-8 bg-sky-300 text-white">
            <h2 className='text-start text-2xl text-gray-600'>Echo Dive</h2>
            <div>
                <Link href={"/"}>単語の編集</Link>
                <Link href={"/"}></Link>
                <Link href={"/"}></Link>
            </div>
        </header>
    )
}

export default Header
