from setuptools import setup, find_packages

setup(
    name='lifeos_sdk',
    version='0.1.0',
    packages=find_packages(),
    install_requires=[
        # Adicione aqui quaisquer dependências que o SDK possa ter
    ],
    author='Project-X',
    author_email='sprint@project-x.ai',
    description='SDK oficial para integrar aplicativos externos ao LifeOS.',
    long_description=open('README.md').read(),
    long_description_content_type='text/markdown',
    url='https://github.com/al6387838-sys/Project-X/lifeos_sdk',
    classifiers=[
        'Programming Language :: Python :: 3',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
    ],
    python_requires='>=3.8',
)
