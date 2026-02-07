
from setuptools import setup, find_packages

setup(
    name="axis-sdk",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "requests>=2.25.1",
    ],
    author="Axis Governance",
    description="Python SDK for the Axis Context Protocol",
)
