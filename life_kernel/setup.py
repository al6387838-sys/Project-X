from setuptools import setup, find_packages

setup(
    name='life_kernel',
    version='0.1.0',
    packages=find_packages(),
    install_requires=[
        # Adicione aqui quaisquer dependências que o life_kernel possa ter
    ],
    author='Project-X',
    author_email='sprint@project-x.ai',
    description='Núcleo de coordenação central para o LifeOS.',
    long_description=open('README.md').read(),
    long_description_content_type='text/markdown',
    url='https://github.com/al6387838-sys/Project-X/life_kernel',
    classifiers=[
        'Programming Language :: Python :: 3',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
    ],
    python_requires='>=3.8',
)
